'use strict';
const express  = require('express');
const router   = express.Router();
const staffCtrl = require('../controllers/staffController');
const shopCtrl = require('../controllers/shopController');
const authCtrl = require('../controllers/authController');

// ── Shop ──────────────────────────────────────────────────────
router.get('/',             shopCtrl.showShop);
router.post('/cart/add',    shopCtrl.addToCart);
router.get('/cart',         shopCtrl.showCart);
router.post('/cart/update', shopCtrl.updateCart);
router.post('/cart/remove', shopCtrl.removeFromCart);
router.post('/cart/clear',  shopCtrl.clearCart);

// ── Checkout & Orders (login required) ───────────────────────
router.get ('/checkout', authCtrl.requireLogin, shopCtrl.showCheckout);
router.post('/checkout', authCtrl.requireLogin, shopCtrl.placeOrder);
router.get ('/orders',   authCtrl.requireLogin, shopCtrl.showOrderHistory);

// ── Auth ──────────────────────────────────────────────────────
router.get ('/login',    authCtrl.showLogin);
router.post('/login',    authCtrl.login);
router.get ('/logout',   authCtrl.logout);
router.get ('/register', authCtrl.showRegister);
router.post('/register', authCtrl.register);
router.get ('/profile',  authCtrl.requireLogin, authCtrl.showProfile);

// ── Staff Auth ────────────────────────────────────────────────
router.get  ('/staff/login',              staffCtrl.showLogin);
router.post ('/staff/login',              staffCtrl.login);
router.get  ('/staff/logout',             staffCtrl.logout);

// ── Staff Dashboard ──────────────────────────────────────────
router.get  ('/staff/dashboard',          staffCtrl.requireStaff, staffCtrl.dashboard);
router.post ('/staff/orders/status',      staffCtrl.requireStaff, staffCtrl.updateOrderStatus);
router.get  ('/staff/orders/:id',         staffCtrl.requireStaff, staffCtrl.showOrderDetail);

// ── Staff Product CRUD ───────────────────────────────────────
router.get  ('/staff/products',           staffCtrl.requireStaff, staffCtrl.showProducts);
router.get  ('/staff/products/add',       staffCtrl.requireStaff, staffCtrl.showAddProduct);
router.post ('/staff/products/add',       staffCtrl.requireStaff, staffCtrl.addProduct);
router.get  ('/staff/products/edit/:id',  staffCtrl.requireStaff, staffCtrl.showEditProduct);
router.post ('/staff/products/edit/:id',  staffCtrl.requireStaff, staffCtrl.editProduct);
router.post ('/staff/products/delete/:id',staffCtrl.requireStaff, staffCtrl.deleteProduct);

// ── Staff Customer CRUD ──────────────────────────────────────
router.get  ('/staff/customers',           staffCtrl.requireStaff, staffCtrl.showCustomers);
router.get  ('/staff/customers/add',       staffCtrl.requireStaff, staffCtrl.showAddCustomer);
router.post ('/staff/customers/add',       staffCtrl.requireStaff, staffCtrl.addCustomer);
router.get  ('/staff/customers/edit/:id',  staffCtrl.requireStaff, staffCtrl.showEditCustomer);
router.post ('/staff/customers/edit/:id',  staffCtrl.requireStaff, staffCtrl.editCustomer);
router.post ('/staff/customers/delete/:id',staffCtrl.requireStaff, staffCtrl.deleteCustomer);

module.exports = router;
