"""
DVT Talent AI — Stripe Billing Migration
Adds billing tables: subscription_plans, credit_transactions,
and adds stripe columns to the tenants table.

Revision ID: 003_billing_stripe
Revises: 002_initial (adjust to your previous revision id)
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers
revision = '003_billing_stripe'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    tenant_cols = {c['name'] for c in inspector.get_columns('tenants')} if 'tenants' in existing_tables else set()

    # ── subscription_plans table ────────────────────────────────────────────
    if 'subscription_plans' not in existing_tables:
        op.create_table(
            'subscription_plans',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('name', sa.String(100), nullable=False, unique=True),
            sa.Column('stripe_price_id', sa.String(255), nullable=False, unique=True),
            sa.Column('credits_per_month', sa.Integer(), nullable=False, server_default='500'),
            sa.Column('features', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('price_usd_cents', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # ── Add stripe columns to tenants ───────────────────────────────────────
    if 'stripe_customer_id' not in tenant_cols:
        op.add_column('tenants', sa.Column('stripe_customer_id', sa.String(255), nullable=True, unique=True))
        op.create_index('ix_tenants_stripe_customer_id', 'tenants', ['stripe_customer_id'])
    if 'subscription_plan_id' not in tenant_cols:
        op.add_column('tenants', sa.Column('subscription_plan_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'fk_tenants_subscription_plan',
            'tenants', 'subscription_plans',
            ['subscription_plan_id'], ['id'],
            ondelete='SET NULL'
        )
    if 'credits_balance' not in tenant_cols:
        op.add_column('tenants', sa.Column('credits_balance', sa.Integer(), nullable=False, server_default='0'))
    if 'credits_last_reset_at' not in tenant_cols:
        op.add_column('tenants', sa.Column('credits_last_reset_at', sa.DateTime(timezone=True), nullable=True))

    # ── credit_transactions table ────────────────────────────────────────────
    if 'credit_transactions' not in existing_tables:
        op.create_table(
            'credit_transactions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('amount', sa.Integer(), nullable=False),
            sa.Column('type', sa.Enum('credit', 'debit', 'refund', name='credittransactiontype'), nullable=False),
            sa.Column('description', sa.String(255), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        )
        op.create_index('ix_credit_transactions_tenant_date', 'credit_transactions', ['tenant_id', 'created_at'])

    # ── Seed default plans ────────────────────────────────────────────────────
    # NOTE: Replace stripe_price_id values with real IDs from your Stripe dashboard
    op.execute("""
        INSERT INTO subscription_plans (id, name, stripe_price_id, credits_per_month, price_usd_cents, features, is_active)
        VALUES
            (gen_random_uuid(), 'Starter',    'price_starter_replace_me',    500,  29900,
             '["500 credits/month", "Autopilot mode", "1 user seat", "Email support"]'::json, true),
            (gen_random_uuid(), 'Growth',     'price_growth_replace_me',    2500,  99900,
             '["2,500 credits/month", "Autopilot + Copilot", "5 user seats", "ATS integration", "Priority support"]'::json, true),
            (gen_random_uuid(), 'Enterprise', 'price_enterprise_replace_me', 10000, 350000,
             '["Unlimited credits", "Autopilot + Copilot", "25 user seats", "SSO (SAML)", "ATS sync", "Dedicated CSM"]'::json, true)
        ON CONFLICT (name) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_index('ix_credit_transactions_tenant_date', 'credit_transactions')
    op.drop_table('credit_transactions')

    op.drop_constraint('fk_tenants_subscription_plan', 'tenants', type_='foreignkey')
    op.drop_index('ix_tenants_stripe_customer_id', 'tenants')
    op.drop_column('tenants', 'credits_last_reset_at')
    op.drop_column('tenants', 'credits_balance')
    op.drop_column('tenants', 'subscription_plan_id')
    op.drop_column('tenants', 'stripe_customer_id')

    op.drop_table('subscription_plans')
    op.execute("DROP TYPE IF EXISTS credittransactiontype;")
