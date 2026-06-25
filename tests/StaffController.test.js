'use strict';

const staffCtrl = require('../controllers/staffController');

// ── Mock models ────────────────────────────────────────────
jest.mock('../models/Account');
jest.mock('../models/Order');
jest.mock('../models/Product');

const Account = require('../models/Account');
const Order   = require('../models/Order');
const Product = require('../models/Product');

// ── Helpers ────────────────────────────────────────────────
function mockRes() {
  const res = {};
  res.render   = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  res.locals   = {};
  return res;
}

function mockReq(overrides = {}) {
  return {
    session: { cart: {} },
    body:    {},
    query:   {},
    params:  {},
    ...overrides,
  };
}

// Default mock returns for model helpers used by dashboard/stats helpers
const defaultStats = {
  totalOrders: 2, totalRevenue: 1000,
  totalCustomers: 3, totalProducts: 10,
};
const defaultOrders = [
  { id: 'o1', status: 'confirmed', createdAt: '2025-01-02T00:00:00Z', total: 100 },
  { id: 'o2', status: 'shipped',   createdAt: '2025-01-01T00:00:00Z', total: 200 },
];

beforeEach(() => {
  jest.clearAllMocks();

  // Default mock setup for stats helpers – many endpoints call these
  Order.getAll.mockReturnValue(defaultOrders);
  Order.totalRevenue.mockReturnValue(defaultStats.totalRevenue);
  Account.getAll.mockReturnValue(
    Array.from({ length: defaultStats.totalCustomers }, (_, i) => ({ id: i + 1, role: 'customer' }))
      .concat({ id: 99, role: 'staff' })
  );
  Account.getCustomers.mockReturnValue(
    Array.from({ length: defaultStats.totalCustomers }, (_, i) => ({ id: i + 1, name: `C${i}`, role: 'customer' }))
  );
  Product.getAll.mockReturnValue(
    Array.from({ length: defaultStats.totalProducts }, (_, i) => ({ id: i + 1, name: `P${i}` }))
  );
  Product.getCategories.mockReturnValue(['Accessories', 'Apparel']);
  Product.getTypes.mockReturnValue(['Backpack', 'T-Shirt']);
});

// ════════════════════════════════════════════════════════════
// requireStaff
// ════════════════════════════════════════════════════════════
describe('requireStaff', () => {
  test('redirects to /staff/login when no user in session', () => {
    const req = mockReq({ session: {} });
    const res = mockRes();
    const next = jest.fn();
    staffCtrl.requireStaff(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/staff/login');
    expect(next).not.toHaveBeenCalled();
  });

  test('redirects when user exists but role is not staff', () => {
    const req = mockReq({ session: { user: { role: 'customer' } } });
    const res = mockRes();
    const next = jest.fn();
    staffCtrl.requireStaff(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/staff/login');
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when user has staff role', () => {
    const req = mockReq({ session: { user: { role: 'staff' } } });
    const res = mockRes();
    const next = jest.fn();
    staffCtrl.requireStaff(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════
// showLogin
// ════════════════════════════════════════════════════════════
describe('showLogin', () => {
  test('renders staff-login without error', () => {
    const req = mockReq();
    const res = mockRes();
    staffCtrl.showLogin(req, res);
    expect(res.render).toHaveBeenCalledWith('staff-login', expect.objectContaining({
      cartCount: 0, error: null,
    }));
  });

  test('passes error message when ?error=1', () => {
    const req = mockReq({ query: { error: '1' } });
    const res = mockRes();
    staffCtrl.showLogin(req, res);
    const args = res.render.mock.calls[0][1];
    expect(args.error).toMatch(/invalid/i);
  });
  test('works when session has no cart (getCart default)', () => {
    const req = { session: {}, query: {} };
    const res = mockRes();
    staffCtrl.showLogin(req, res);
    expect(res.render).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════
// login
// ════════════════════════════════════════════════════════════
describe('login', () => {
  test('renders error when email or password missing', () => {
    const req = mockReq({ body: { email: '', password: '' } });
    const res = mockRes();
    staffCtrl.login(req, res);
    expect(res.render).toHaveBeenCalled();
    const args = res.render.mock.calls[0][1];
    expect(args.error).toMatch(/fill/i);
  });

  test('renders error when email missing only', () => {
    const req = mockReq({ body: { email: '', password: 'secret' } });
    const res = mockRes();
    staffCtrl.login(req, res);
    expect(res.render.mock.calls[0][1].error).toMatch(/fill/i);
  });

  test('renders error when password missing only', () => {
    const req = mockReq({ body: { email: 'a@b.com', password: '' } });
    const res = mockRes();
    staffCtrl.login(req, res);
    expect(res.render.mock.calls[0][1].error).toMatch(/fill/i);
  });

  test('renders error when Account.authenticate returns null', () => {
    Account.authenticate.mockReturnValue(null);
    const req = mockReq({ body: { email: 'a@b.com', password: 'wrong' } });
    const res = mockRes();
    staffCtrl.login(req, res);
    expect(res.render.mock.calls[0][1].error).toMatch(/invalid/i);
  });

  test('renders error when user role is not staff', () => {
    Account.authenticate.mockReturnValue({ id: 1, name: 'A', email: 'a@b.com', role: 'customer' });
    const req = mockReq({ body: { email: 'a@b.com', password: 'secret' } });
    const res = mockRes();
    staffCtrl.login(req, res);
    expect(res.render.mock.calls[0][1].error).toMatch(/invalid/i);
  });

  test('sets session and redirects on successful staff login', () => {
    Account.authenticate.mockReturnValue({ id: 1, name: 'Staff', email: 's@t.com', address: 'addr', role: 'staff' });
    const req = mockReq({ body: { email: 's@t.com', password: 'secret' } });
    const res = mockRes();
    staffCtrl.login(req, res);
    expect(req.session.user).toBeDefined();
    expect(req.session.user.role).toBe('staff');
    expect(res.redirect).toHaveBeenCalledWith('/staff/dashboard');
  });

  test('handles missing address in user record', () => {
    Account.authenticate.mockReturnValue({ id: 2, name: 'NoAddr', email: 'n@t.com', role: 'staff' });
    const req = mockReq({ body: { email: 'n@t.com', password: 's' } });
    const res = mockRes();
    staffCtrl.login(req, res);
    expect(req.session.user.address).toBe('');
    expect(res.redirect).toHaveBeenCalledWith('/staff/dashboard');
  });
});

// ════════════════════════════════════════════════════════════
// dashboard
// ════════════════════════════════════════════════════════════
describe('dashboard', () => {
  test('renders staff-dashboard with stats, orders, statuses', () => {
    const req = mockReq({ session: { user: { name: 'Staff' } } });
    const res = mockRes();
    staffCtrl.dashboard(req, res);
    expect(res.render).toHaveBeenCalledWith('staff-dashboard', expect.objectContaining({
      layout: 'staff-main',
      stats: {
        totalOrders: 2, totalRevenue: 1000,
        totalCustomers: 3, totalProducts: 10,
      },
      user: req.session.user,
    }));
    const args = res.render.mock.calls[0][1];
    expect(args.orders).toHaveLength(2);
    expect(args.statuses).toEqual(expect.arrayContaining(['confirmed', 'shipped']));
    expect(args.cartCount).toBe(0);
  });

  test('sorts orders by createdAt descending', () => {
    const req = mockReq({ session: { user: {} } });
    const res = mockRes();
    staffCtrl.dashboard(req, res);
    const args = res.render.mock.calls[0][1];
    expect(args.orders[0].id).toBe('o1'); // 2025-01-02 after 'o2' 2025-01-01
  });
});

// ════════════════════════════════════════════════════════════
// updateOrderStatus
// ════════════════════════════════════════════════════════════
describe('updateOrderStatus', () => {
  test('redirects with error=1 when orderId missing', () => {
    const req = mockReq({ body: { status: 'shipped' } });
    const res = mockRes();
    staffCtrl.updateOrderStatus(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/dashboard?error=1');
  });

  test('redirects with error=1 when status missing', () => {
    const req = mockReq({ body: { orderId: 'o1' } });
    const res = mockRes();
    staffCtrl.updateOrderStatus(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/dashboard?error=1');
  });

  test('redirects with error=2 when status is invalid', () => {
    const req = mockReq({ body: { orderId: 'o1', status: 'invalid-status' } });
    const res = mockRes();
    staffCtrl.updateOrderStatus(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/dashboard?error=2');
  });


  test('redirects to #orders on success', () => {
    Order.updateStatus.mockReturnValue({ id: 'o1', status: 'shipped' });
    const req = mockReq({ body: { orderId: 'o1', status: 'shipped' } });
    const res = mockRes();
    staffCtrl.updateOrderStatus(req, res);
    expect(Order.updateStatus).toHaveBeenCalledWith('o1', 'shipped');
    expect(res.redirect).toHaveBeenCalledWith('/staff/dashboard#orders');
  });

  test('redirects with error=3 when Order.updateStatus throws', () => {
    Order.updateStatus.mockImplementation(() => { throw new Error('DB err'); });
    const req = mockReq({ body: { orderId: 'o1', status: 'shipped' } });
    const res = mockRes();
    staffCtrl.updateOrderStatus(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/dashboard?error=3');
  });

  test('accepts all valid statuses', () => {
    const statuses = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    for (const s of statuses) {
      Order.updateStatus.mockReturnValue({ id: 'o1', status: s });
      const req = mockReq({ body: { orderId: 'o1', status: s } });
      const res = mockRes();
      staffCtrl.updateOrderStatus(req, res);
      expect(res.redirect).toHaveBeenCalledWith('/staff/dashboard#orders');
    }
  });
});

// ════════════════════════════════════════════════════════════
// showOrderDetail
// ════════════════════════════════════════════════════════════
describe('showOrderDetail', () => {
  test('renders dashboard with selectedOrder when order found', () => {
    const order = { id: 'o1', status: 'confirmed' };
    Order.getById.mockReturnValue(order);
    const req = mockReq({ params: { id: 'o1' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.showOrderDetail(req, res);
    expect(res.render).toHaveBeenCalledWith('staff-dashboard', expect.objectContaining({
      selectedOrder: order,
    }));
  });

  test('redirects when order not found', () => {
    Order.getById.mockReturnValue(null);
    const req = mockReq({ params: { id: 'ghost' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.showOrderDetail(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/dashboard');
  });
});

// ════════════════════════════════════════════════════════════
// Product CRUD – showProducts / showAddProduct
// ════════════════════════════════════════════════════════════
describe('showProducts', () => {
  test('renders staff-products with product list', () => {
    const req = mockReq({ session: { user: {} }, query: {} });
    const res = mockRes();
    staffCtrl.showProducts(req, res);
    expect(res.render).toHaveBeenCalledWith('staff-products', expect.objectContaining({
      products: expect.any(Array),
      categories: ['Accessories', 'Apparel'],
      types: ['Backpack', 'T-Shirt'],
    }));
  });

  test('passes success and error messages from query', () => {
    const req = mockReq({ session: { user: {} }, query: { success: 'added', error: '' } });
    const res = mockRes();
    staffCtrl.showProducts(req, res);
    const args = res.render.mock.calls[0][1];
    expect(args.success).toBe('added');
    expect(args.error).toBe('');
  });
});

describe('showAddProduct', () => {
  test('renders staff-product-form with product=null', () => {
    const req = mockReq({ session: { user: {} } });
    const res = mockRes();
    staffCtrl.showAddProduct(req, res);
    expect(res.render).toHaveBeenCalledWith('staff-product-form', expect.objectContaining({
      product: null,
      categories: ['Accessories', 'Apparel'],
      types: ['Backpack', 'T-Shirt'],
    }));
  });
});

// ════════════════════════════════════════════════════════════
// addProduct
// ════════════════════════════════════════════════════════════
describe('addProduct', () => {
  test('redirects with error=1 when required fields missing', () => {
    const req = mockReq({ body: { name: '', price: '', category: '', type: '', desc: '' } });
    const res = mockRes();
    staffCtrl.addProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=1');
  });

  test('redirects with error=1 when name missing', () => {
    const req = mockReq({ body: { price: '10', category: 'A', type: 'T', desc: 'd' } });
    const res = mockRes();
    staffCtrl.addProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=1');
  });

  test('redirects with error=1 when price missing', () => {
    const req = mockReq({ body: { name: 'N', category: 'A', type: 'T', desc: 'd' } });
    const res = mockRes();
    staffCtrl.addProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=1');
  });

  test('redirects with error=1 when category missing', () => {
    const req = mockReq({ body: { name: 'N', price: '10', type: 'T', desc: 'd' } });
    const res = mockRes();
    staffCtrl.addProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=1');
  });

  test('redirects with error=1 when type missing', () => {
    const req = mockReq({ body: { name: 'N', price: '10', category: 'A', desc: 'd' } });
    const res = mockRes();
    staffCtrl.addProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=1');
  });

  test('redirects with error=1 when desc missing', () => {
    const req = mockReq({ body: { name: 'N', price: '10', category: 'A', type: 'T' } });
    const res = mockRes();
    staffCtrl.addProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=1');
  });

  test('calls Product.add and redirects with success on valid input', () => {
    Product.add.mockReturnValue({ id: 99 });
    const req = mockReq({
      body: { name: 'New', price: '25', image: '/img.svg', category: 'Acc', type: 'Bag', badge: 'New', desc: 'Desc' },
    });
    const res = mockRes();
    staffCtrl.addProduct(req, res);
    expect(Product.add).toHaveBeenCalledWith({
      name: 'New', price: '25', image: '/img.svg',
      category: 'Acc', type: 'Bag', badge: 'New', desc: 'Desc',
    });
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?success=added');
  });

  test('redirects with error message when Product.add throws', () => {
    Product.add.mockImplementation(() => { throw new Error('fail'); });
    const req = mockReq({
      body: { name: 'N', price: '1', image: '', category: 'C', type: 'T', badge: '', desc: 'd' },
    });
    const res = mockRes();
    staffCtrl.addProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=fail');
  });
});

// ════════════════════════════════════════════════════════════
// showEditProduct
// ════════════════════════════════════════════════════════════
describe('showEditProduct', () => {
  test('renders form with product when found', () => {
    const product = { id: 1, name: 'P1' };
    Product.getById.mockReturnValue(product);
    const req = mockReq({ params: { id: '1' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.showEditProduct(req, res);
    expect(res.render).toHaveBeenCalledWith('staff-product-form', expect.objectContaining({
      product,
    }));
  });

  test('redirects when product not found', () => {
    Product.getById.mockReturnValue(undefined);
    const req = mockReq({ params: { id: '999' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.showEditProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=notfound');
  });
});

// ════════════════════════════════════════════════════════════
// editProduct
// ════════════════════════════════════════════════════════════
describe('editProduct', () => {
  test('calls Product.update and redirects with success', () => {
    Product.update.mockReturnValue({ id: 1 });
    const req = mockReq({
      params: { id: '1' },
      body: { name: 'U', price: '30', image: '', category: 'C', type: 'T', badge: '', desc: 'D' },
    });
    const res = mockRes();
    staffCtrl.editProduct(req, res);
    expect(Product.update).toHaveBeenCalledWith('1', {
      name: 'U', price: '30', image: '', category: 'C', type: 'T', badge: '', desc: 'D',
    });
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?success=edited');
  });

  test('redirects with error when Product.update throws', () => {
    Product.update.mockImplementation(() => { throw new Error('update fail'); });
    const req = mockReq({
      params: { id: '999' },
      body: { name: 'U', price: '1', image: '', category: 'C', type: 'T', badge: '', desc: 'd' },
    });
    const res = mockRes();
    staffCtrl.editProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=update%20fail');
  });
});

// ════════════════════════════════════════════════════════════
// deleteProduct
// ════════════════════════════════════════════════════════════
describe('deleteProduct', () => {
  test('calls Product.delete and redirects with success', () => {
    Product.delete.mockReturnValue({ id: 1 });
    const req = mockReq({ params: { id: '1' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.deleteProduct(req, res);
    expect(Product.delete).toHaveBeenCalledWith('1');
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?success=deleted');
  });

  test('redirects with error when Product.delete throws', () => {
    Product.delete.mockImplementation(() => { throw new Error('del err'); });
    const req = mockReq({ params: { id: '999' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.deleteProduct(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/products?error=del%20err');
  });
});

// ════════════════════════════════════════════════════════════
// Customer CRUD – showCustomers / showAddCustomer
// ════════════════════════════════════════════════════════════
describe('showCustomers', () => {
  test('renders staff-customers with customer list', () => {
    const req = mockReq({ session: { user: {} }, query: {} });
    const res = mockRes();
    staffCtrl.showCustomers(req, res);
    expect(res.render).toHaveBeenCalledWith('staff-customers', expect.objectContaining({
      customers: expect.any(Array),
      success: undefined,
      error: undefined,
    }));
  });
});

describe('showAddCustomer', () => {
  test('renders staff-customer-form with customer=null', () => {
    const req = mockReq({ session: { user: {} } });
    const res = mockRes();
    staffCtrl.showAddCustomer(req, res);
    expect(res.render).toHaveBeenCalledWith('staff-customer-form', expect.objectContaining({
      customer: null,
    }));
  });
});

// ════════════════════════════════════════════════════════════
// addCustomer
// ════════════════════════════════════════════════════════════
describe('addCustomer', () => {
  test('redirects with error=1 when fields missing', () => {
    const req = mockReq({ body: { name: '', email: '', password: '', address: '' } });
    const res = mockRes();
    staffCtrl.addCustomer(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?error=1');
  });

  test('redirects with error=1 when name missing', () => {
    const req = mockReq({ body: { email: 'a@b.com', password: 's', address: 'addr' } });
    const res = mockRes();
    staffCtrl.addCustomer(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?error=1');
  });

  test('calls Account.add and redirects with success', () => {
    Account.add.mockReturnValue({ id: 1 });
    const req = mockReq({
      body: { name: 'NewC', email: 'c@t.com', password: 'p', address: 'Addr', role: 'customer' },
    });
    const res = mockRes();
    staffCtrl.addCustomer(req, res);
    expect(Account.add).toHaveBeenCalledWith({
      name: 'NewC', email: 'c@t.com', password: 'p', address: 'Addr', role: 'customer',
    });
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?success=added');
  });

  test('defaults role to customer when not provided', () => {
    Account.add.mockReturnValue({ id: 2 });
    const req = mockReq({
      body: { name: 'N', email: 'n@t.com', password: 'p', address: 'A' },
    });
    const res = mockRes();
    staffCtrl.addCustomer(req, res);
    expect(Account.add).toHaveBeenCalledWith({
      name: 'N', email: 'n@t.com', password: 'p', address: 'A', role: 'customer',
    });
  });

  test('redirects with error when Account.add throws', () => {
    Account.add.mockImplementation(() => { throw new Error('email taken'); });
    const req = mockReq({
      body: { name: 'N', email: 'dup@t.com', password: 'p', address: 'A' },
    });
    const res = mockRes();
    staffCtrl.addCustomer(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?error=email%20taken');
  });
});

// ════════════════════════════════════════════════════════════
// showEditCustomer
// ════════════════════════════════════════════════════════════
describe('showEditCustomer', () => {
  test('renders form with customer when found', () => {
    const customer = { id: 1, name: 'C1' };
    Account.findById.mockReturnValue(customer);
    const req = mockReq({ params: { id: '1' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.showEditCustomer(req, res);
    expect(res.render).toHaveBeenCalledWith('staff-customer-form', expect.objectContaining({
      customer,
    }));
  });

  test('redirects when customer not found', () => {
    Account.findById.mockReturnValue(undefined);
    const req = mockReq({ params: { id: '999' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.showEditCustomer(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?error=notfound');
  });
});

// ════════════════════════════════════════════════════════════
// editCustomer
// ════════════════════════════════════════════════════════════
describe('editCustomer', () => {
  test('calls Account.update and redirects with success', () => {
    Account.update.mockReturnValue({ id: 1 });
    const req = mockReq({
      params: { id: '1' },
      body: { name: 'U', email: 'u@t.com', address: 'NewAddr', password: 'newp', role: 'customer' },
    });
    const res = mockRes();
    staffCtrl.editCustomer(req, res);
    expect(Account.update).toHaveBeenCalledWith('1', {
      name: 'U', email: 'u@t.com', address: 'NewAddr', password: 'newp', role: 'customer',
    });
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?success=edited');
  });

  test('only sends non-empty fields to Account.update', () => {
    Account.update.mockReturnValue({ id: 1 });
    const req = mockReq({
      params: { id: '1' },
      body: { name: 'U', email: '', address: 'Addr', password: '', role: '' },
    });
    const res = mockRes();
    staffCtrl.editCustomer(req, res);
    expect(Account.update).toHaveBeenCalledWith('1', { name: 'U', address: 'Addr' });
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?success=edited');
  });

  test('redirects with error when Account.update throws', () => {
    Account.update.mockImplementation(() => { throw new Error('not found'); });
    const req = mockReq({
      params: { id: '999' },
      body: { name: 'U', email: '', address: '', password: '', role: '' },
    });
    const res = mockRes();
    staffCtrl.editCustomer(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?error=not%20found');
  });
  test('updates only provided fields when name is empty', () => {
    Account.update.mockReturnValue({ id: 1 });
    const req = mockReq({
      params: { id: '1' },
      body: { name: '', email: 'e@t.com', address: '', password: '', role: '' },
    });
    const res = mockRes();
    staffCtrl.editCustomer(req, res);
    expect(Account.update).toHaveBeenCalledWith('1', { email: 'e@t.com' });
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?success=edited');
  });
});

// ════════════════════════════════════════════════════════════
// deleteCustomer
// ════════════════════════════════════════════════════════════
describe('deleteCustomer', () => {
  test('calls Account.delete and redirects with success', () => {
    Account.delete.mockReturnValue({ id: 1 });
    const req = mockReq({ params: { id: '1' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.deleteCustomer(req, res);
    expect(Account.delete).toHaveBeenCalledWith('1');
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?success=deleted');
  });

  test('redirects with error when Account.delete throws', () => {
    Account.delete.mockImplementation(() => { throw new Error('del err'); });
    const req = mockReq({ params: { id: '999' }, session: { user: {} } });
    const res = mockRes();
    staffCtrl.deleteCustomer(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/staff/customers?error=del%20err');
  });
});

// ════════════════════════════════════════════════════════════
// logout
// ════════════════════════════════════════════════════════════
describe('logout', () => {
  test('removes user from session and redirects to login', () => {
    const req = mockReq({ session: { user: { id: 1 } } });
    const res = mockRes();
    staffCtrl.logout(req, res);
    expect(req.session.user).toBeUndefined();
    expect(res.redirect).toHaveBeenCalledWith('/staff/login');
  });
});

