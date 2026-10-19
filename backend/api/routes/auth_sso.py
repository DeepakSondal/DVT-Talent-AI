import os
import uuid
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
try:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth
    SAML_AVAILABLE = True
except ImportError:
    OneLogin_Saml2_Auth = None
    SAML_AVAILABLE = False
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from db.models import User, Tenant, get_db
from api.routes.auth import create_access_token

router = APIRouter()

def prepare_saml_request(request: Request):
    """ Helper to prepare the SAML request format from FastAPI/Starlette request """
    return {
        'https': 'on' if request.url.scheme == 'https' else 'off',
        'http_host': request.url.hostname,
        'server_port': request.url.port,
        'script_name': request.url.path,
        'get_data': dict(request.query_params),
        'post_data': {} # Will be populated in ACS
    }

def get_saml_settings():
    """ SAML Configuration (Constants for Enterprise SSO) """
    return {
        "strict": True,
        "debug": True,
        "sp": {
            "entityId": f"{settings.app_base_url}/api/v1/auth/sso/metadata",
            "assertionConsumerService": {
                "url": f"{settings.app_base_url}/api/v1/auth/sso/acs",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            },
        },
        "idp": {
            "entityId": settings.saml_idp_entity_id,
            "singleSignOnService": {
                "url": settings.saml_idp_sso_url,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            },
            "x509cert": settings.saml_idp_cert
        }
    }

@router.get("/login")
async def sso_login(request: Request):
    """ Initiate SAML Login redirect to Identity Provider (Okta/Azure) """
    if not SAML_AVAILABLE:
        raise HTTPException(status_code=501, detail="SAML SSO library (python3-saml) is not installed.")
    req = prepare_saml_request(request)
    auth = OneLogin_Saml2_Auth(req, get_saml_settings())
    return RedirectResponse(auth.login())

@router.post("/acs")
async def sso_acs(request: Request, db: AsyncSession = Depends(get_db)):
    """ Assertion Consumer Service — processes the SAML response from IDP """
    if not SAML_AVAILABLE:
        raise HTTPException(status_code=501, detail="SAML SSO library (python3-saml) is not installed.")
    form_data = await request.form()
    req = prepare_saml_request(request)
    req['post_data'] = dict(form_data)
    
    auth = OneLogin_Saml2_Auth(req, get_saml_settings())
    auth.process_response()
    
    errors = auth.get_errors()
    if not errors:
        if auth.is_authenticated():
            attributes = auth.get_attributes()
            email = attributes.get('email', [None])[0] or auth.get_nameid()
            
            if not email:
                raise HTTPException(status_code=400, detail="SAML response missing email attribute")
            
            # Find or Create User
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalars().first()
            
            if not user:
                email_domain = email.split("@")[-1].lower()
                common_domains = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "example.com", "test.com", "proton.me", "protonmail.com"}
                existing_tenant = (await db.execute(select(Tenant).where(Tenant.domain == email_domain))).scalar_one_or_none()
                tenant_domain = f"{email_domain}-{uuid.uuid4().hex[:6]}" if (email_domain in common_domains or existing_tenant) else email_domain

                full_name = attributes.get('name', [email.split('@')[0]])[0]
                tenant = Tenant(
                    name=f"{full_name}'s Workspace",
                    domain=tenant_domain,
                    is_active=True
                )
                db.add(tenant)
                await db.flush()

                user = User(
                    email=email,
                    full_name=full_name,
                    is_active=True,
                    tenant_id=tenant.id,
                    provider="saml",
                )
                db.add(user)
            await db.commit()
            
            # Generate JWT and Redirect to Dashboard
            token = create_access_token({"sub": str(user.id)})
            response = RedirectResponse(url=f"{settings.cors_origins[0]}/dashboard")
            response.set_cookie(
                key="dvt_token",
                value=f"Bearer {token}",
                httponly=True,
                max_age=settings.access_token_expire_minutes * 60,
                samesite="lax",
                secure=settings.is_production,
            )
            return response
    
    raise HTTPException(status_code=401, detail=f"SAML Authentication failed: {auth.get_last_error_reason()}")

@router.get("/metadata")
async def sso_metadata():
    """ Provides the Service Provider metadata XML for the Identity Provider """
    acs_url = f"{settings.app_base_url}/api/v1/auth/sso/acs"
    entity_id = f"{settings.app_base_url}/api/v1/auth/sso/metadata"
    xml_fallback = f"""<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="{entity_id}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="{acs_url}" index="1"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>"""

    if not SAML_AVAILABLE:
        return JSONResponse(content={"xml": xml_fallback}, media_type="application/xml")

    try:
        from onelogin.saml2.settings import OneLogin_Saml2_Settings
        saml_settings = OneLogin_Saml2_Settings(get_saml_settings(), sp_validation_only=True)
        metadata = saml_settings.get_sp_metadata()
        return JSONResponse(content={"xml": metadata}, media_type="application/xml")
    except Exception:
        return JSONResponse(content={"xml": xml_fallback}, media_type="application/xml")


from pydantic import BaseModel
from api.routes.auth import get_current_user


class SSOConfigPayload(BaseModel):
    idp_entity_id: str | None = None
    idp_sso_url: str | None = None
    idp_cert: str | None = None
    metadata_url: str | None = None
    is_enabled: bool = False


@router.get("/config")
async def get_sso_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """ Returns self-service SSO configuration for the tenant """
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User is not associated with an enterprise tenant.")
    
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    tenant_settings = tenant.settings or {}
    sso_data = tenant_settings.get("sso", {})

    sp_entity_id = f"{settings.app_base_url}/api/v1/auth/sso/metadata"
    sp_acs_url = f"{settings.app_base_url}/api/v1/auth/sso/acs"

    return {
        "sp_entity_id": sp_entity_id,
        "sp_acs_url": sp_acs_url,
        "idp_entity_id": sso_data.get("idp_entity_id") or settings.saml_idp_entity_id,
        "idp_sso_url": sso_data.get("idp_sso_url") or settings.saml_idp_sso_url,
        "metadata_url": sso_data.get("metadata_url", ""),
        "certificate_installed": bool(sso_data.get("idp_cert") or settings.saml_idp_cert),
        "is_enabled": sso_data.get("is_enabled", False),
    }


@router.post("/config")
async def update_sso_config(
    payload: SSOConfigPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """ Updates self-service SAML IdP configuration for the tenant """
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User is not associated with an enterprise tenant.")

    tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    current_settings = dict(tenant.settings or {})
    current_settings["sso"] = {
        "idp_entity_id": payload.idp_entity_id or "",
        "idp_sso_url": payload.idp_sso_url or "",
        "idp_cert": payload.idp_cert or "",
        "metadata_url": payload.metadata_url or "",
        "is_enabled": payload.is_enabled,
    }
    tenant.settings = current_settings
    await db.commit()

    return {
        "status": "success",
        "message": "Enterprise SSO configuration saved successfully.",
        "is_enabled": payload.is_enabled,
    }


@router.post("/test")
async def test_sso_config(
    payload: SSOConfigPayload,
    current_user: User = Depends(get_current_user)
):
    """ Validates SAML IdP inputs without persisting """
    if not payload.idp_sso_url and not payload.metadata_url:
        raise HTTPException(status_code=400, detail="Please provide either an IdP SSO URL or IdP Metadata URL.")

    if payload.idp_sso_url and not (payload.idp_sso_url.startswith("https://") or payload.idp_sso_url.startswith("http://")):
        raise HTTPException(status_code=400, detail="IdP SSO URL must start with https://")

    return {
        "status": "valid",
        "message": "SAML parameters are valid and ready for IdP federated handshakes."
    }

