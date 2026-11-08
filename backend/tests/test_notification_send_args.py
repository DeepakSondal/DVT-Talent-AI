"""Guards the recruiter notification -> EmailService.send_email call contract."""
import inspect

from services.email_service import EmailService
from services import notification_service as ns


def test_send_email_signature_requires_email_id_and_to_address():
    params = inspect.signature(EmailService.send_email).parameters
    assert "email_id" in params and "to_address" in params


def test_notification_passes_required_send_email_args():
    src = inspect.getsource(ns)
    assert "email_id=" in src and "to_address=" in src


def test_notification_no_longer_uses_stale_to_email_kwarg():
    assert "to_email=" not in inspect.getsource(ns)
