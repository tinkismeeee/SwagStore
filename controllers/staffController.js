'use strict';

const Account = require('../models/Account');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const Cart    = require('../models/Cart');

function getCart(req) {
  return new Cart(req.session.cart || {});
}

// ── Middleware ───────────────────────────────────────────────
exports.requireStaff = (req, res, next) => {
  const user = req.session.user;
  if (user && user.role === 'staff') return next();
  res.redirect('/staff/login');
};

// ── Staff Login ─────────────────────────────────────────────
exports.showLogin = (req, res) => {
  const cart = getCart(req);
  res.render('staff-login', {
    cartCount: cart.count,
    error: req.query.error === '1' ? 'Invalid email or password.' : null,
  });
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  const cart = getCart(req);

  if (!email || !password) {
    return res.render('staff-login', {
      error: 'Please fill in all fields.',
      cartCount: cart.count,
      form: { email },
    });
  }

  const user = Account.authenticate(email, password);
  if (!user || user.role !== 'staff') {
    return res.render('staff-login', {
      error: 'Invalid email or password.',
      cartCount: cart.count,
      form: { email },
    });
  }

  req.session.user = {
    id:      user.id,
    name:    user.name,
    email:   user.email,
    address: user.address || '',
    role:    'staff',
  };
  res.locals.user = req.session.user;
  res.redirect('/staff/dashboard');
};

// ── Dashboard ───────────────────────────────────────────────
exports.dashboard = (req, res) => {
  const allOrders = Order.getAll();
  const allAccounts = Account.getAll();

  const stats = {
    totalOrders:    allOrders.length,
    totalRevenue:   Order.totalRevenue(),
    totalCustomers: allAccounts.filter(a => a.role === 'customer').length,
    totalProducts:  Product.getAll().length,
  };

  const orders = allOrders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const statuses = [...new Set(orders.map(o => o.status))];

  res.render('staff-dashboard', {
    layout: 'staff-main',
    stats,
    orders,
    statuses,
    user: req.session.user,
    cartCount: 0,
  });
};

// ── Update order status ─────────────────────────────────────
exports.updateOrderStatus = (req, res) => {
  const { orderId, status } = req.body;
  if (!orderId || !status) return res.redirect('/staff/dashboard?error=1');

  const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) return res.redirect('/staff/dashboard?error=2');

  try {
    Order.updateStatus(orderId, status);
    res.redirect('/staff/dashboard#orders');
  } catch (err) {
    res.redirect('/staff/dashboard?error=3');
  }
};

// ── Order detail ────────────────────────────────────────────
exports.showOrderDetail = (req, res) => {
  const order = Order.getById(req.params.id);
  if (!order) return res.redirect('/staff/dashboard');

  const allOrders = Order.getAll();
  const stats = {
    totalOrders:    allOrders.length,
    totalRevenue:   Order.totalRevenue(),
    totalCustomers: Account.getAll().filter(a => a.role === 'customer').length,
    totalProducts:  Product.getAll().length,
  };

  res.render('staff-dashboard', {
    layout: 'staff-main',
    stats,
    orders: allOrders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    statuses: [...new Set(allOrders.map(o => o.status))],
    selectedOrder: order,
    user: req.session.user,
    cartCount: 0,
  });
};

// ═══════════════════════════════════════════════════════════
// PRODUCT CRUD
// ═══════════════════════════════════════════════════════════

// GET /staff/products
exports.showProducts = (req, res) => {
  const products = Product.getAll();
  const allOrders = Order.getAll();
  const stats = {
    totalOrders:    allOrders.length,
    totalRevenue:   Order.totalRevenue(),
    totalCustomers: Account.getAll().filter(a => a.role === 'customer').length,
    totalProducts:  products.length,
  };

  res.render('staff-products', {
    layout: 'staff-main',
    stats,
    products,
    categories: Product.getCategories(),
    types: Product.getTypes(),
    user: req.session.user,
    cartCount: 0,
    success: req.query.success,
    error:   req.query.error,
  });
};

// GET /staff/products/add
exports.showAddProduct = (req, res) => {
  const allOrders = Order.getAll();
  const stats = {
    totalOrders:    allOrders.length,
    totalRevenue:   Order.totalRevenue(),
    totalCustomers: Account.getAll().filter(a => a.role === 'customer').length,
    totalProducts:  Product.getAll().length,
  };

  res.render('staff-product-form', {
    layout: 'staff-main',
    stats,
    product: null,
    categories: Product.getCategories(),
    types: Product.getTypes(),
    user: req.session.user,
    cartCount: 0,
  });
};

// POST /staff/products/add
exports.addProduct = (req, res) => {
  const { name, price, image, category, type, badge, desc } = req.body;
  if (!name || !price || !category || !type || !desc) {
    return res.redirect('/staff/products?error=1');
  }

  try {
    Product.add({ name, price, image, category, type, badge, desc });
    res.redirect('/staff/products?success=added');
  } catch (err) {
    res.redirect('/staff/products?error=' + encodeURIComponent(err.message));
  }
};

// GET /staff/products/edit/:id
exports.showEditProduct = (req, res) => {
  const product = Product.getById(req.params.id);
  if (!product) return res.redirect('/staff/products?error=notfound');

  const allOrders = Order.getAll();
  const stats = {
    totalOrders:    allOrders.length,
    totalRevenue:   Order.totalRevenue(),
    totalCustomers: Account.getAll().filter(a => a.role === 'customer').length,
    totalProducts:  Product.getAll().length,
  };

  res.render('staff-product-form', {
    layout: 'staff-main',
    stats,
    product,
    categories: Product.getCategories(),
    types: Product.getTypes(),
    user: req.session.user,
    cartCount: 0,
  });
};

// POST /staff/products/edit/:id
exports.editProduct = (req, res) => {
  const { name, price, image, category, type, badge, desc } = req.body;

  try {
    Product.update(req.params.id, { name, price, image, category, type, badge, desc });
    res.redirect('/staff/products?success=edited');
  } catch (err) {
    res.redirect('/staff/products?error=' + encodeURIComponent(err.message));
  }
};

// POST /staff/products/delete/:id
exports.deleteProduct = (req, res) => {
  try {
    Product.delete(req.params.id);
    res.redirect('/staff/products?success=deleted');
  } catch (err) {
    res.redirect('/staff/products?error=' + encodeURIComponent(err.message));
  }
};

// ═══════════════════════════════════════════════════════════
// CUSTOMER CRUD
// ═══════════════════════════════════════════════════════════

// GET /staff/customers
exports.showCustomers = (req, res) => {
  const customers = Account.getCustomers();
  const allOrders = Order.getAll();
  const stats = {
    totalOrders:    allOrders.length,
    totalRevenue:   Order.totalRevenue(),
    totalCustomers: customers.length,
    totalProducts:  Product.getAll().length,
  };

  res.render('staff-customers', {
    layout: 'staff-main',
    stats,
    customers,
    user: req.session.user,
    cartCount: 0,
    success: req.query.success,
    error:   req.query.error,
  });
};

// GET /staff/customers/add
exports.showAddCustomer = (req, res) => {
  const allOrders = Order.getAll();
  const stats = {
    totalOrders:    allOrders.length,
    totalRevenue:   Order.totalRevenue(),
    totalCustomers: Account.getCustomers().length,
    totalProducts:  Product.getAll().length,
  };

  res.render('staff-customer-form', {
    layout: 'staff-main',
    stats,
    customer: null,
    user: req.session.user,
    cartCount: 0,
  });
};

// POST /staff/customers/add
exports.addCustomer = (req, res) => {
  const { name, email, password, address, role } = req.body;

  if (!name || !email || !password || !address) {
    return res.redirect('/staff/customers?error=1');
  }

  try {
    Account.add({ name, email, password, address, role: role || 'customer' });
    res.redirect('/staff/customers?success=added');
  } catch (err) {
    res.redirect('/staff/customers?error=' + encodeURIComponent(err.message));
  }
};

// GET /staff/customers/edit/:id
exports.showEditCustomer = (req, res) => {
  const customer = Account.findById(req.params.id);
  if (!customer) return res.redirect('/staff/customers?error=notfound');

  const allOrders = Order.getAll();
  const stats = {
    totalOrders:    allOrders.length,
    totalRevenue:   Order.totalRevenue(),
    totalCustomers: Account.getCustomers().length,
    totalProducts:  Product.getAll().length,
  };

  res.render('staff-customer-form', {
    layout: 'staff-main',
    stats,
    customer,
    user: req.session.user,
    cartCount: 0,
  });
};

// POST /staff/customers/edit/:id
exports.editCustomer = (req, res) => {
  const { name, email, address, password, role } = req.body;

  try {
    const fields = {};
    if (name)     fields.name = name;
    if (email)    fields.email = email;
    if (address)  fields.address = address;
    if (role)     fields.role = role;
    if (password) fields.password = password;

    Account.update(req.params.id, fields);
    res.redirect('/staff/customers?success=edited');
  } catch (err) {
    res.redirect('/staff/customers?error=' + encodeURIComponent(err.message));
  }
};

// POST /staff/customers/delete/:id
exports.deleteCustomer = (req, res) => {
  try {
    Account.delete(req.params.id);
    res.redirect('/staff/customers?success=deleted');
  } catch (err) {
    res.redirect('/staff/customers?error=' + encodeURIComponent(err.message));
  }
};

// ── Logout ──────────────────────────────────────────────────
exports.logout = (req, res) => {
  delete req.session.user;
  res.redirect('/staff/login');
};
