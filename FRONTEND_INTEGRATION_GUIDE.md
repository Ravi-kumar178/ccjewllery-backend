# Frontend Integration Guide

## Payment Methods Available

1. **COD (Cash on Delivery)** - No payment processing required
2. **Authorize.Net** - Credit card payment processing

---

## Required Environment Variables

Make sure your `.env` file has these variables:

```env
# MongoDB
MONGODB_URL=mongodb://127.0.0.1:27017/forever
PORT=4000

# Cloudinary (for product images)
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_SECRET_KEY=your_secret_key

# Authorize.Net (for credit card payments)
AUTHNET_LOGIN_ID=your_login_id
AUTHNET_TRANSACTION_KEY=your_transaction_key
AUTHNET_MODE=sandbox  # or 'production' for live

# Admin (optional)
ADMIN_LOGIN=admin@forever.com
ADMIN_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

---

## API Endpoints

### Base URL
```
http://localhost:4000/api
```

---

## 1. COD (Cash on Delivery) Integration

### Endpoint
```
POST /api/order/place
```

### Request Body
```json
{
  "cartId": "507f1f77bcf86cd799439011",
  "amount": 5000,  // Optional - will be calculated from cart if not provided
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "street": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "USA",
  "phone": "1234567890"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Order Placed",
  "order": {
    "_id": "507f1f77bcf86cd799439011",
    "cartId": "507f1f77bcf86cd799439011",
    "items": [...],
    "amount": 5000,
    "paymentMethod": "COD",
    "payment": false,
    "status": "Order Placed",
    ...
  }
}
```

### Frontend Example (React/JavaScript)
```javascript
const placeCODOrder = async (cartId, customerInfo) => {
  try {
    const response = await fetch('http://localhost:4000/api/order/place', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartId: cartId,
        amount: customerInfo.amount, // Optional
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        email: customerInfo.email,
        street: customerInfo.street,
        city: customerInfo.city,
        state: customerInfo.state,
        zipCode: customerInfo.zipCode,
        country: customerInfo.country,
        phone: customerInfo.phone
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Order placed successfully:', data.order);
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error placing order:', error);
    throw error;
  }
};
```

---

## 2. Authorize.Net Integration

### Endpoint
```
POST /api/order/authnet
```

### Request Body
```json
{
  "cartId": "507f1f77bcf86cd799439011",
  "amount": 5000,  // Optional - will be calculated from cart
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "street": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "USA",
  "phone": "1234567890",
  "cardNumber": "4111111111111111",  // Test card for sandbox
  "cardExpiry": "12/25",  // Format: MM/YY
  "cardCVV": "123"
}
```

### Test Cards (Sandbox Mode)
- **Approved**: `4111111111111111`
- **Declined**: `4222222222222220`
- **CVV**: Any 3 digits (e.g., `123`)
- **Expiry**: Any future date in MM/YY format (e.g., `12/25`)

### Response (Success)
```json
{
  "success": true,
  "message": "Payment successful",
  "order": {
    "_id": "507f1f77bcf86cd799439011",
    "transactionId": "SIM_1234567890",
    "payment": true,
    "paymentMethod": "Authorize.Net",
    "status": "Paid",
    ...
  }
}
```

### Response (Failed)
```json
{
  "success": false,
  "message": "Payment failed: This transaction has been declined.",
  "order": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "Payment Failed",
    ...
  }
}
```

### Frontend Example (React/JavaScript)
```javascript
const placeAuthorizeNetOrder = async (cartId, customerInfo, cardInfo) => {
  try {
    const response = await fetch('http://localhost:4000/api/order/authnet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartId: cartId,
        amount: customerInfo.amount, // Optional
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        email: customerInfo.email,
        street: customerInfo.street,
        city: customerInfo.city,
        state: customerInfo.state,
        zipCode: customerInfo.zipCode,
        country: customerInfo.country,
        phone: customerInfo.phone,
        cardNumber: cardInfo.cardNumber.replace(/\s/g, ''), // Remove spaces
        cardExpiry: cardInfo.cardExpiry, // Format: MM/YY
        cardCVV: cardInfo.cardCVV
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Payment successful:', data.order);
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Payment error:', error);
    throw error;
  }
};
```

---

## 3. Get Order by Cart ID

### Endpoint
```
POST /api/order/getorder
```

### Request Body
```json
{
  "cartId": "507f1f77bcf86cd799439011"
}
```

### Response
```json
{
  "success": true,
  "order": {
    "_id": "507f1f77bcf86cd799439011",
    "cartId": "...",
    "items": [...],
    "amount": 5000,
    "paymentMethod": "COD",
    "payment": false,
    "status": "Order Placed",
    ...
  }
}
```

---

## Complete Frontend Checkout Flow Example

```javascript
// Complete checkout flow
const handleCheckout = async (cartId, customerInfo, paymentMethod, cardInfo = null) => {
  try {
    let orderData;
    
    if (paymentMethod === 'COD') {
      // Cash on Delivery
      orderData = await placeCODOrder(cartId, customerInfo);
    } else if (paymentMethod === 'AUTHORIZE_NET') {
      // Credit Card Payment
      if (!cardInfo) {
        throw new Error('Card information is required');
      }
      orderData = await placeAuthorizeNetOrder(cartId, customerInfo, cardInfo);
    } else {
      throw new Error('Invalid payment method');
    }
    
    // Success - redirect to order confirmation
    if (orderData.success) {
      // Store order ID in localStorage or state
      localStorage.setItem('lastOrderId', orderData.order._id);
      
      // Redirect to success page
      window.location.href = `/order-confirmation/${orderData.order._id}`;
    }
    
    return orderData;
  } catch (error) {
    console.error('Checkout error:', error);
    // Show error message to user
    alert(error.message || 'An error occurred during checkout');
    throw error;
  }
};

// Usage
const checkoutForm = {
  cartId: '507f1f77bcf86cd799439011',
  customerInfo: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'USA',
    phone: '1234567890'
  },
  paymentMethod: 'AUTHORIZE_NET', // or 'COD'
  cardInfo: {
    cardNumber: '4111111111111111',
    cardExpiry: '12/25',
    cardCVV: '123'
  }
};

// Call checkout
handleCheckout(
  checkoutForm.cartId,
  checkoutForm.customerInfo,
  checkoutForm.paymentMethod,
  checkoutForm.cardInfo
);
```

---

## React Component Example

```jsx
import React, { useState } from 'react';

function CheckoutForm({ cartId }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    phone: '',
    paymentMethod: 'COD',
    cardNumber: '',
    cardExpiry: '',
    cardCVV: ''
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const endpoint = formData.paymentMethod === 'COD' 
        ? '/api/order/place'
        : '/api/order/authnet';
      
      const body = {
        cartId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        street: formData.street,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        country: formData.country,
        phone: formData.phone
      };
      
      if (formData.paymentMethod === 'AUTHORIZE_NET') {
        body.cardNumber = formData.cardNumber.replace(/\s/g, '');
        body.cardExpiry = formData.cardExpiry;
        body.cardCVV = formData.cardCVV;
      }
      
      const response = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Order placed successfully!');
        // Redirect to success page
        window.location.href = `/order-confirmation/${data.order._id}`;
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      alert('An error occurred: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Customer Info Fields */}
      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
        required
      />
      {/* ... other fields ... */}
      
      {/* Payment Method Selection */}
      <select
        value={formData.paymentMethod}
        onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
      >
        <option value="COD">Cash on Delivery</option>
        <option value="AUTHORIZE_NET">Credit Card</option>
      </select>
      
      {/* Card Fields (only show if Authorize.Net selected) */}
      {formData.paymentMethod === 'AUTHORIZE_NET' && (
        <>
          <input
            type="text"
            placeholder="Card Number"
            value={formData.cardNumber}
            onChange={(e) => setFormData({...formData, cardNumber: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="MM/YY"
            value={formData.cardExpiry}
            onChange={(e) => setFormData({...formData, cardExpiry: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="CVV"
            value={formData.cardCVV}
            onChange={(e) => setFormData({...formData, cardCVV: e.target.value})}
            required
          />
        </>
      )}
      
      <button type="submit" disabled={loading}>
        {loading ? 'Processing...' : 'Place Order'}
      </button>
    </form>
  );
}

export default CheckoutForm;
```

---

## Important Notes

1. **No Authentication Required**: Both COD and Authorize.Net endpoints are public (no authentication needed)

2. **Amount Calculation**: If `amount` is not provided, it will be automatically calculated from cart items + delivery charge

3. **Card Number Format**: Remove all spaces from card number before sending (e.g., `4111 1111 1111 1111` → `4111111111111111`)

4. **Expiry Format**: Must be `MM/YY` format (e.g., `12/25` for December 2025)

5. **Sandbox Mode**: Currently in sandbox mode - use test cards only. Change `AUTHNET_MODE=production` in `.env` for live payments

6. **Error Handling**: Always check `data.success` before proceeding

7. **CORS**: Make sure your frontend URL is allowed in CORS settings if deploying

---

## Testing

### Test COD Order
```bash
curl -X POST http://localhost:4000/api/order/place \
  -H "Content-Type: application/json" \
  -d '{
    "cartId": "YOUR_CART_ID",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA",
    "phone": "1234567890"
  }'
```

### Test Authorize.Net Order
```bash
curl -X POST http://localhost:4000/api/order/authnet \
  -H "Content-Type: application/json" \
  -d '{
    "cartId": "YOUR_CART_ID",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA",
    "phone": "1234567890",
    "cardNumber": "4111111111111111",
    "cardExpiry": "12/25",
    "cardCVV": "123"
  }'
```

