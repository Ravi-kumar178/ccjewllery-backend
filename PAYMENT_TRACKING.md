# Payment Tracking System

## Overview

Every order now has a **unique transaction ID** and **order number** for tracking payments, regardless of payment method.

## Order Tracking Fields

### 1. **Order Number** (`orderNumber`)
- **Format**: `ORD-{timestamp}-{random}` (e.g., `ORD-LX9K2M-AB3C`)
- **Unique**: Every order gets a unique order number
- **Purpose**: Customer-friendly order reference
- **Example**: `ORD-LX9K2M-AB3C`

### 2. **Transaction ID** (`transactionId`)
- **COD Orders**: `COD-{timestamp}-{random}` (e.g., `COD-1703123456789-XYZ123`)
- **Authorize.Net Orders**: Real Authorize.Net transaction ID (e.g., `60012345678`)
- **Purpose**: Payment gateway transaction reference
- **Example**: `60012345678` or `COD-1703123456789-XYZ123`

### 3. **Payment Status** (`paymentStatus`)
- `pending` - Payment not yet received (COD orders)
- `completed` - Payment successfully processed
- `failed` - Payment attempt failed
- `refunded` - Payment was refunded

### 4. **Payment Details** (`paymentDetails`)
Contains complete payment information:
```json
{
  "gateway": "AUTHORIZE_NET" | "COD",
  "transactionId": "60012345678",
  "responseCode": "1",
  "responseMessage": "This transaction has been approved.",
  "processedAt": "2024-01-15T10:30:00Z"
}
```

## How It Works

### COD (Cash on Delivery) Orders

1. **Order Created**: 
   - `orderNumber`: `ORD-LX9K2M-AB3C`
   - `transactionId`: `COD-1703123456789-XYZ123`
   - `paymentStatus`: `pending`
   - `payment`: `false`

2. **When Delivered** (manual update needed):
   - Update `paymentStatus` to `completed`
   - Update `payment` to `true`
   - Update `paymentDate`

### Authorize.Net Orders

1. **Order Created**:
   - `orderNumber`: `ORD-LX9K2M-AB3C`
   - `transactionId`: `null` (initially)
   - `paymentStatus`: `pending`

2. **Payment Processed**:
   - If **Success**: 
     - `transactionId`: `60012345678` (from Authorize.Net)
     - `paymentStatus`: `completed`
     - `payment`: `true`
     - `paymentDate`: Current timestamp
   - If **Failed**:
     - `transactionId`: `null`
     - `paymentStatus`: `failed`
     - `payment`: `false`
     - Error details in `paymentDetails`

## API Endpoints for Tracking

### 1. Get Order by Cart ID
```bash
POST /api/order/getorder
Body: { "cartId": "507f1f77bcf86cd799439011" }
```

**Response:**
```json
{
  "success": true,
  "order": { ... },
  "orderNumber": "ORD-LX9K2M-AB3C",
  "transactionId": "60012345678",
  "paymentStatus": "completed"
}
```

### 2. Get Order by Transaction ID
```bash
POST /api/order/getbytransaction
Body: { "transactionId": "60012345678" }
```

**Response:**
```json
{
  "success": true,
  "order": { ... },
  "orderNumber": "ORD-LX9K2M-AB3C",
  "transactionId": "60012345678",
  "paymentStatus": "completed",
  "paymentDetails": {
    "gateway": "AUTHORIZE_NET",
    "transactionId": "60012345678",
    "responseCode": "1",
    "responseMessage": "This transaction has been approved.",
    "processedAt": "2024-01-15T10:30:00Z"
  }
}
```

### 3. Get Order by Order Number
```bash
POST /api/order/getbyordernumber
Body: { "orderNumber": "ORD-LX9K2M-AB3C" }
```

**Response:** Same as above

### 4. Get All Orders (Admin)
```bash
POST /api/order/list
Headers: { "token": "admin_token" }
```

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "_id": "...",
      "orderNumber": "ORD-LX9K2M-AB3C",
      "transactionId": "60012345678",
      "paymentStatus": "completed",
      "paymentDetails": { ... },
      "amount": 5000,
      ...
    }
  ],
  "total": 10
}
```

## Database Schema

### Order Model Fields:
```javascript
{
  orderNumber: String,        // Unique order number
  transactionId: String,      // Payment transaction ID
  paymentStatus: String,      // 'pending' | 'completed' | 'failed' | 'refunded'
  paymentDate: Date,          // When payment was processed
  paymentDetails: {
    gateway: String,          // 'AUTHORIZE_NET' | 'COD'
    transactionId: String,    // Gateway transaction ID
    responseCode: String,     // Gateway response code
    responseMessage: String,  // Gateway response message
    processedAt: Date         // Processing timestamp
  },
  paymentMethod: String,      // 'COD' | 'Authorize.Net'
  payment: Boolean,           // true if paid, false if not
  status: String,            // Order status
  // ... other fields
}
```

## Usage Examples

### Frontend: Display Order Confirmation
```javascript
// After placing order
const response = await postMethod({
  url: '/order/authnet',
  body: orderData
});

if (response.success) {
  console.log('Order Number:', response.orderNumber);
  console.log('Transaction ID:', response.transactionId);
  // Show to customer for tracking
}
```

### Admin: Track Payments
```javascript
// Get all orders with payment info
const orders = await postMethod({
  url: '/order/list',
  body: {}
});

orders.orders.forEach(order => {
  console.log(`Order ${order.orderNumber}:`);
  console.log(`  Transaction: ${order.transactionId}`);
  console.log(`  Status: ${order.paymentStatus}`);
  console.log(`  Amount: $${order.amount}`);
});
```

### Customer: Track Order
```javascript
// Customer can track by order number
const order = await postMethod({
  url: '/order/getbyordernumber',
  body: { orderNumber: 'ORD-LX9K2M-AB3C' }
});

console.log('Payment Status:', order.paymentStatus);
console.log('Transaction ID:', order.transactionId);
```

## Important Notes

1. **Every Order Has Transaction ID**:
   - COD orders get `COD-{timestamp}-{random}`
   - Authorize.Net orders get real gateway transaction ID

2. **Order Numbers Are Unique**:
   - Generated using timestamp + random string
   - Format: `ORD-{base36_timestamp}-{random}`

3. **Payment Status Tracking**:
   - Automatically updated for Authorize.Net
   - Manual update needed for COD (when delivered)

4. **Transaction IDs Are Searchable**:
   - Can search orders by transaction ID
   - Can search orders by order number
   - Both are unique identifiers

5. **Payment Details Store Complete Info**:
   - Gateway used
   - Response codes and messages
   - Processing timestamps
   - Useful for debugging and customer support

## Admin Dashboard Integration

When displaying orders in admin dashboard, show:
- Order Number (for customer reference)
- Transaction ID (for payment tracking)
- Payment Status (pending/completed/failed)
- Payment Method (COD/Authorize.Net)
- Payment Date (when processed)

This allows easy tracking and management of all payments!

