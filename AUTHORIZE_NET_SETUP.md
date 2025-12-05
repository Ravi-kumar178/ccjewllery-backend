# Authorize.Net Real Payment Setup Guide

## Step 1: Create Authorize.Net Account

1. **Sign Up for Authorize.Net**
   - Go to: https://www.authorize.net/
   - Click "Sign Up" or "Get Started"
   - Choose a plan (Payment Gateway or All-in-One)
   - Complete registration

2. **Get Your API Credentials**
   - Login to your Authorize.Net account
   - Go to **Account** → **Settings** → **Security Settings** → **API Credentials**
   - You'll need:
     - **API Login ID** (also called Transaction Key ID)
     - **Transaction Key** (you may need to generate this)

## Step 2: Get Transaction Key

1. In Authorize.Net dashboard, go to **Account** → **Settings**
2. Click **Security Settings** → **API Credentials**
3. Click **New Transaction Key** (if you don't have one)
4. **IMPORTANT**: Copy the Transaction Key immediately - you can only see it once!
5. If you lose it, you'll need to generate a new one

## Step 3: Choose Your Environment

### Option A: Sandbox (Testing) - Recommended First
- Use sandbox credentials for testing
- No real money is charged
- Test cards work
- Endpoint: `apitest.authorize.net`

### Option B: Production (Live Payments)
- Use production credentials
- Real money is charged
- Real credit cards only
- Endpoint: `api.authorize.net`

## Step 4: Configure Backend Environment Variables

Create or update your `.env` file in `ccjewllery-backend/`:

### For Sandbox (Testing):
```env
AUTHNET_LOGIN_ID=your_sandbox_login_id
AUTHNET_TRANSACTION_KEY=your_sandbox_transaction_key
AUTHNET_MODE=sandbox
```

### For Production (Live):
```env
AUTHNET_LOGIN_ID=your_production_login_id
AUTHNET_TRANSACTION_KEY=your_production_transaction_key
AUTHNET_MODE=production
```

## Step 5: Security Best Practices

### ⚠️ CRITICAL: Never Commit Credentials to Git

1. **Add to .gitignore** (already done):
   ```
   .env
   ```

2. **Use Environment Variables**:
   - Never hardcode credentials in code
   - Use `.env` file (not committed to git)
   - For production deployment, use your hosting platform's environment variables

3. **Different Credentials for Different Environments**:
   - Use sandbox credentials for development
   - Use production credentials only in production
   - Never mix them!

## Step 6: Test Your Setup

### Test in Sandbox First:

1. **Start Backend**:
   ```bash
   cd ccjewllery-backend
   pnpm start
   ```

2. **Test with Sandbox Cards**:
   - Approved: `4111111111111111`
   - Declined: `4222222222222220`
   - CVV: Any 3 digits (e.g., `123`)
   - Expiry: Any future date (e.g., `12/25`)

3. **Check Backend Logs**:
   - Should see: "SANDBOX MODE - Using Authorize.Net sandbox API"
   - Or: "PRODUCTION MODE - Processing real payment"

### Test in Production (After Sandbox Works):

1. **Update .env** to production credentials
2. **Set AUTHNET_MODE=production**
3. **Use REAL credit card** (test cards won't work)
4. **Start with small amount** to verify

## Step 7: Verify Payment Processing

### Check Transaction in Authorize.Net Dashboard:

1. Login to Authorize.Net
2. Go to **Transactions** → **Unsettled Transactions**
3. You should see your test transactions
4. In sandbox, transactions are marked as "Test"

## Step 8: Production Deployment

### For Vercel/Netlify/Render:

1. **Add Environment Variables** in your hosting platform:
   - `AUTHNET_LOGIN_ID`
   - `AUTHNET_TRANSACTION_KEY`
   - `AUTHNET_MODE=production`

2. **Never commit .env to git**

3. **Restart your backend** after adding variables

## Troubleshooting

### Error: "Invalid API Login ID"
- Check your Login ID is correct
- Make sure you're using the right environment (sandbox vs production)

### Error: "Invalid Transaction Key"
- Transaction Key might be expired
- Generate a new one in Authorize.Net dashboard
- Make sure there are no extra spaces when copying

### Error: "Transaction declined"
- In sandbox: Use test cards only
- In production: Check card details, funds, etc.

### Transactions not appearing
- Check Authorize.Net dashboard
- Verify you're looking at the right environment (sandbox vs production)
- Check backend logs for errors

## Important Notes

1. **PCI Compliance**: 
   - Authorize.Net handles PCI compliance
   - Never store full card numbers
   - Only store transaction IDs

2. **Transaction Fees**:
   - Check Authorize.Net pricing
   - Usually: ~2.9% + $0.30 per transaction

3. **Refunds**:
   - Can be processed through Authorize.Net dashboard
   - Or implement refund API (future feature)

4. **Webhooks**:
   - Consider setting up webhooks for payment notifications
   - Not required for basic setup

## Support

- Authorize.Net Support: https://support.authorize.net/
- API Documentation: https://developer.authorize.net/api/reference/
- Test Cards: https://developer.authorize.net/hello_world/testing_guide/

