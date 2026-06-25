'use strict';

const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'data', 'products.json');
const types = require('../data/types.json');
const Category = require('./Category');

function readProducts() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    return JSON.parse(clean) || [];
  } catch (_) {
    return [];
  }
}

function writeProducts(list) {
  fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), 'utf8');
}

class Product {
  static getAll()      { return readProducts(); }
  
  static getById(id)   { return Product.getAll().find(p => p.id === Number(id)); }
  
  static getCategories() { return Category.getAll(); }
  
  static getTypes() { return types; }

  static add({ name, price, image, category, type, badge, desc }) {
    const products = Product.getAll();
    const maxId = products.reduce((m, p) => Math.max(m, p.id), 0);
    const product = {
      id: maxId + 1,
      name: String(name).trim(),
      price: Number(price),
      image: String(image).trim() || '/images/backpack.svg',
      category: String(category).trim(),
      type: String(type).trim(),
      badge: badge && String(badge).trim() ? String(badge).trim() : null,
      desc: String(desc).trim(),
    };
    products.push(product);
    writeProducts(products);
    return product;
  }

  static update(id, fields) {
    const products = Product.getAll();
    const idx = products.findIndex(p => p.id === Number(id));
    if (idx === -1) throw new Error('Product not found.');
    const allowed = ['name', 'price', 'image', 'category', 'type', 'badge', 'desc'];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        if (key === 'price') products[idx][key] = Number(fields[key]);
        else if (key === 'badge') products[idx][key] = String(fields[key]).trim() || null;
        else products[idx][key] = String(fields[key]).trim();
      }
    }
    writeProducts(products);
    return products[idx];
  }

  static delete(id) {
    const products = Product.getAll();
    const idx = products.findIndex(p => p.id === Number(id));
    if (idx === -1) throw new Error('Product not found.');
    const removed = products.splice(idx, 1)[0];
    writeProducts(products);
    return removed;
  }
}

module.exports = Product;
