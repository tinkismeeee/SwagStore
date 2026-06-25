'use strict';

const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');

const dataFile = path.join(__dirname, '..', 'data', 'accounts.json');

function readAccounts() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const clean = (raw && raw.charCodeAt(0) === 0xFEFF) ? raw.slice(1) : raw;
    const accounts = clean ? JSON.parse(clean) : [];
    return Array.isArray(accounts) ? accounts : [];
  } catch (_) {
    return [];
  }
}

function writeAccounts(accounts) {
  fs.writeFileSync(dataFile, JSON.stringify(accounts, null, 2), 'utf8');
}

class Account {
  static getAll() {
    return readAccounts();
  }

  static getCustomers() {
    return Account.getAll().filter(a => a.role === 'customer');
  }

  static findByEmail(email) {
    return Account.getAll().find(a => a.email === String(email).trim().toLowerCase());
  }

  static findById(id) {
    return Account.getAll().find(a => String(a.id) === String(id));
  }

  static hashPassword(password) {
    return bcrypt.hashSync(String(password), 10);
  }

  static verifyPassword(password, hash) {
    if (/^[a-f0-9]{64}$/.test(hash)) {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(String(password)).digest('hex') === hash;
    }
    return bcrypt.compareSync(String(password), hash);
  }

  static authenticate(email, password) {
    const user = Account.findByEmail(email);
    if (!user) return null;
    return Account.verifyPassword(password, user.passwordHash) ? user : null;
  }

  static add({ name, email, password, address, role }) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!name || !normalizedEmail || !password || !address) {
      throw new Error('All fields are required.');
    }
    if (Account.findByEmail(normalizedEmail)) {
      throw new Error('Email already registered.');
    }

    const accounts  = Account.getAll();
    const newAccount = {
      id:           Date.now(),
      name:         String(name).trim(),
      email:        normalizedEmail,
      address:      String(address).trim(),
      passwordHash: Account.hashPassword(password),
      role:         role === 'staff' ? 'staff' : 'customer',
      createdAt:    new Date().toISOString(),
    };
    accounts.push(newAccount);
    writeAccounts(accounts);
    return newAccount;
  }

  static update(id, fields) {
    const accounts = Account.getAll();
    const idx = accounts.findIndex(a => String(a.id) === String(id));
    if (idx === -1) throw new Error('Account not found.');

    if (fields.password) {
      fields.passwordHash = Account.hashPassword(fields.password);
      delete fields.password;
    }
    if (fields.email) {
      fields.email = String(fields.email).trim().toLowerCase();
    }

    accounts[idx] = { ...accounts[idx], ...fields, updatedAt: new Date().toISOString() };
    writeAccounts(accounts);
    return accounts[idx];
  }

  static resetPassword(id, newPassword) {
    return Account.update(id, { password: newPassword });
  }

  static delete(id) {
    const accounts = Account.getAll();
    const idx = accounts.findIndex(a => String(a.id) === String(id));
    if (idx === -1) throw new Error('Account not found.');
    const removed = accounts.splice(idx, 1)[0];
    writeAccounts(accounts);
    return removed;
  }
}

module.exports = Account;
