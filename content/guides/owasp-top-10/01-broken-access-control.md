---
title: 'A01: Broken Access Control'
description: 'Learn about broken access control vulnerabilities, how attackers exploit them, and best practices to prevent unauthorized access in your applications.'
---

Broken Access Control moved up from the fifth position in the 2017 OWASP Top 10 to become the **#1 most critical** web application security risk in 2021. This isn't surprising—access control determines who can do what in your application, and getting it wrong has devastating consequences.

## What is Broken Access Control?

Access control enforces policy such that users cannot act outside of their intended permissions. When access control is broken, attackers can:

- **View other users' data** - Accessing records they shouldn't see
- **Modify data** - Changing someone else's profile, posts, or settings
- **Perform privileged actions** - Admin functions without admin rights
- **Delete resources** - Removing content belonging to others

Think of it like a hotel key card system that's broken—your card should only open your room, but a flaw lets you access any room in the building.

## Common Vulnerability Patterns

### 1. Insecure Direct Object References (IDOR)

IDOR occurs when an application uses user-supplied input to access objects directly without proper authorization checks.

**Vulnerable Example:**

Imagine an API endpoint that retrieves user invoices:

```javascript
// VULNERABLE: No authorization check!
app.get('/api/invoices/:invoiceId', async (req, res) => {
  const invoice = await Invoice.findById(req.params.invoiceId);
  res.json(invoice);
});
```

The problem here is obvious once you see it: any authenticated user can request ANY invoice by simply changing the `invoiceId` parameter. User A could access User B's invoices by guessing or incrementing IDs.

**Secure Implementation:**

```javascript
// SECURE: Verify the invoice belongs to the requesting user
app.get('/api/invoices/:invoiceId', async (req, res) => {
  const invoice = await Invoice.findById(req.params.invoiceId);
  
  // First, check if the invoice even exists
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  // Then verify the requesting user owns this invoice
  // req.user is set by authentication middleware
  if (invoice.userId !== req.user.id) {
    // Return 404 instead of 403 to avoid revealing that the resource exists
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  res.json(invoice);
});
```

The key insight is that **authentication is not authorization**. Just because someone is logged in doesn't mean they can access everything. Every request must verify the user has permission to access that specific resource.

### 2. Privilege Escalation

Privilege escalation happens when users gain access to functions or data reserved for higher privilege levels.

**Horizontal Escalation** - Accessing another user's resources at the same privilege level (like the IDOR example above).

**Vertical Escalation** - Gaining higher privileges, such as a regular user accessing admin functionality.

**Vulnerable Example:**

```javascript
// VULNERABLE: Only checks if user is logged in, not their role
app.delete('/api/admin/users/:userId', isAuthenticated, async (req, res) => {
  await User.delete(req.params.userId);
  res.json({ message: 'User deleted' });
});
```

This endpoint uses authentication middleware but doesn't verify the user has admin privileges. Any logged-in user could delete other users!

**Secure Implementation:**

```javascript
// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  // isAuthenticated middleware already verified the user
  // Now check their role
  if (req.user.role !== 'admin') {
    // Log the attempt - this could be an attack
    logger.warn('Unauthorized admin access attempt', {
      userId: req.user.id,
      attemptedAction: 'delete_user',
      targetUserId: req.params.userId,
      ip: req.ip
    });
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// SECURE: Chain both authentication AND authorization middleware
app.delete('/api/admin/users/:userId', isAuthenticated, requireAdmin, async (req, res) => {
  await User.delete(req.params.userId);
  res.json({ message: 'User deleted' });
});
```

### 3. Missing Function Level Access Control

This occurs when the application doesn't properly restrict access to certain functions or pages. A common mistake is hiding admin links in the UI but not protecting the actual endpoints.

**Vulnerable Pattern:**

```javascript
// Frontend "security" - just hiding the button
{user.isAdmin && <button onClick={deleteAllUsers}>Delete All Users</button>}

// Backend has no protection - security through obscurity doesn't work!
app.post('/api/danger/delete-all-users', async (req, res) => {
  await User.deleteMany({});
  res.json({ message: 'All users deleted' });
});
```

Attackers don't use your UI—they send requests directly to your API. If the endpoint exists and isn't protected, they will find it.

**Secure Implementation:**

```javascript
// Defense in depth: protect BOTH frontend and backend

// Backend protection is mandatory
app.post('/api/admin/delete-all-users', 
  isAuthenticated,      // Must be logged in
  requireAdmin,         // Must be an admin
  requireMFA,           // Sensitive action - require MFA confirmation
  rateLimit({ max: 1, windowMs: 60000 }), // Rate limit dangerous operations
  async (req, res) => {
    // Log this action for audit purposes
    logger.info('Admin initiated user deletion', {
      adminId: req.user.id,
      timestamp: new Date().toISOString()
    });
    
    await User.deleteMany({});
    res.json({ message: 'All users deleted' });
  }
);
```

## Prevention Best Practices

### 1. Deny by Default

Start with everything locked down and explicitly grant access. This is the opposite of allowing everything and trying to block specific actions.

```javascript
// Create a permission system that denies by default
const permissions = {
  'invoice:read': ['user', 'admin', 'accountant'],
  'invoice:create': ['user', 'admin', 'accountant'],
  'invoice:delete': ['admin', 'accountant'],
  'user:delete': ['admin'],
  'settings:modify': ['admin']
};

function hasPermission(userRole, action) {
  // If the action isn't defined, deny by default
  const allowedRoles = permissions[action];
  if (!allowedRoles) {
    logger.warn(`Undefined permission requested: ${action}`);
    return false;
  }
  return allowedRoles.includes(userRole);
}

// Middleware using the permission system
const requirePermission = (action) => (req, res, next) => {
  if (!hasPermission(req.user.role, action)) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  next();
};

// Usage
app.delete('/api/invoices/:id', 
  isAuthenticated, 
  requirePermission('invoice:delete'),
  deleteInvoiceHandler
);
```

### 2. Use Indirect References

Instead of exposing database IDs (which are often sequential), use non-guessable references.

```javascript
// Instead of /api/users/1, /api/users/2, etc.
// Use UUIDs: /api/users/550e8400-e29b-41d4-a716-446655440000

const { v4: uuidv4 } = require('uuid');

// When creating resources
const newInvoice = new Invoice({
  publicId: uuidv4(),  // Use this in URLs
  userId: req.user.id,
  amount: req.body.amount
});

// When querying, use the public ID
app.get('/api/invoices/:publicId', async (req, res) => {
  const invoice = await Invoice.findOne({ 
    publicId: req.params.publicId,
    userId: req.user.id  // Still verify ownership!
  });
  // ...
});
```

Using UUIDs makes it impossible to enumerate resources by incrementing IDs. However, **this is not a substitute for proper authorization checks**—it's an additional layer of defense.

### 3. Implement Row-Level Security

Many databases support row-level security (RLS), which enforces access control at the database level. This provides defense in depth—even if your application code has a bug, the database won't return unauthorized data.

```sql
-- PostgreSQL Row Level Security Example

-- Enable RLS on the invoices table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create a policy: users can only see their own invoices
-- current_user_id() is a function that returns the authenticated user's ID
CREATE POLICY user_invoices ON invoices
  FOR SELECT
  USING (user_id = current_user_id());

-- Admins can see all invoices
CREATE POLICY admin_all_invoices ON invoices
  FOR ALL
  USING (current_user_role() = 'admin');
```

With RLS enabled, even if your application code forgets to filter by user ID, the database will automatically apply the restriction.

### 4. Centralize Access Control Logic

Don't scatter authorization checks throughout your codebase. Centralize them to reduce the chance of mistakes.

```javascript
// access-control.js - Centralized authorization
class AccessControl {
  static async canAccessInvoice(user, invoiceId) {
    if (user.role === 'admin') return true;
    
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return false;
    
    // User can access their own invoices
    if (invoice.userId === user.id) return true;
    
    // Accountants can access invoices from their assigned companies
    if (user.role === 'accountant') {
      return user.assignedCompanies.includes(invoice.companyId);
    }
    
    return false;
  }
  
  static async canDeleteUser(actor, targetUserId) {
    // Only admins can delete users
    if (actor.role !== 'admin') return false;
    
    // Admins cannot delete themselves (prevent lockout)
    if (actor.id === targetUserId) return false;
    
    // Super admins cannot be deleted by regular admins
    const target = await User.findById(targetUserId);
    if (target?.role === 'super_admin' && actor.role !== 'super_admin') {
      return false;
    }
    
    return true;
  }
}

// Usage in route handlers
app.get('/api/invoices/:id', isAuthenticated, async (req, res) => {
  if (!await AccessControl.canAccessInvoice(req.user, req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  // ... fetch and return invoice
});
```

## Testing for Broken Access Control

### Manual Testing Checklist

When testing your application, try these common attack patterns:

1. **IDOR Testing**: Change resource IDs in URLs and request bodies
2. **Role Testing**: Access admin endpoints as a regular user
3. **HTTP Method Testing**: Try DELETE/PUT on resources you can only GET
4. **Parameter Manipulation**: Modify user IDs, role parameters in requests
5. **Force Browsing**: Access URLs directly without going through the UI

### Automated Testing

Include access control tests in your test suite:

```javascript
// Example test using Jest
describe('Invoice Access Control', () => {
  test('users cannot access other users invoices', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const invoice = await createInvoice({ userId: user1.id });
    
    // User2 tries to access User1's invoice
    const response = await request(app)
      .get(`/api/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${user2.token}`);
    
    // Should return 404 (not 403, to avoid revealing existence)
    expect(response.status).toBe(404);
  });
  
  test('regular users cannot access admin endpoints', async () => {
    const regularUser = await createTestUser({ role: 'user' });
    
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${regularUser.token}`);
    
    expect(response.status).toBe(403);
  });
});
```

## Key Takeaways

1. **Authentication ≠ Authorization**: Being logged in doesn't grant access to everything
2. **Deny by default**: Start restrictive and explicitly grant permissions
3. **Validate on every request**: Don't assume previous checks are sufficient
4. **Server-side enforcement**: Never rely solely on client-side restrictions
5. **Use indirect references**: UUIDs are harder to guess than sequential IDs
6. **Test extensively**: Include access control tests in your automated test suite
7. **Log failures**: Access control violations might indicate an attack

Broken access control is the #1 vulnerability for a reason—it's easy to get wrong and devastating when exploited. Take the time to design your authorization system carefully and test it thoroughly.
