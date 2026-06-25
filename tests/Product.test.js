'use strict';

const fs      = require('fs');
const path    = require('path');
const Product = require('../models/Product');

const dataFile = path.join(__dirname, '..', 'data', 'products.json');
const backup   = path.join(__dirname, '..', 'data', 'products.json.bak');

const SAMPLE = {
  name: 'Test Product', price: 19.99, image: '/img/test.svg',
  category: 'Accessories', type: 'Backpack', badge: 'New', desc: 'Test desc.',
};

beforeAll(() => { if (fs.existsSync(dataFile)) fs.copyFileSync(dataFile, backup); });
afterAll(()  => { if (fs.existsSync(backup)) { fs.copyFileSync(backup, dataFile); fs.unlinkSync(backup); } });
beforeEach(() => {
  const original = JSON.parse(fs.readFileSync(backup, 'utf8'));
  fs.writeFileSync(dataFile, JSON.stringify(original, null, 2));
});

// ── Existing tests (kept) ───────────────────────────────────
describe('Product model – read operations', () => {
  test('getAll returns all products', () => {
    const products = Product.getAll();
    expect(products).toBeInstanceOf(Array);
    expect(products.length).toBeGreaterThanOrEqual(6);
  });

  test('getById returns the correct product', () => {
    const product = Product.getById(1);
    expect(product).toBeDefined();
    expect(product.id).toBe(1);
    expect(product.name).toContain('Sauce Labs Backpack');
  });

  test('getById returns undefined for missing product', () => {
    expect(Product.getById(999)).toBeUndefined();
  });

  test('getById works with string id', () => {
    expect(Product.getById('1')).toBeDefined();
  });

  test('getCategories returns unique categories', () => {
    const categories = Product.getCategories();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories).toEqual(expect.arrayContaining(['Accessories', 'Apparel', 'Outdoor']));
  });

  test('getTypes returns unique types from JSON', () => {
    const types = Product.getTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(types).toEqual(expect.arrayContaining(['Backpack', 'T-Shirt', 'Onesie']));
  });
});

// ── getAll edge cases ───────────────────────────────────────
describe('Product.getAll() – edge cases', () => {
  test('returns [] when file is invalid JSON', () => {
    fs.writeFileSync(dataFile, 'not-json');
    expect(Product.getAll()).toEqual([]);
  });

  test('returns [] when file is empty', () => {
    fs.writeFileSync(dataFile, '');
    expect(Product.getAll()).toEqual([]);
  });

  test('strips BOM character', () => {
    fs.writeFileSync(dataFile, '\uFEFF[]');
    expect(Product.getAll()).toEqual([]);
  });
  test('returns [] when file contains null', () => {
    fs.writeFileSync(dataFile, 'null');
    expect(Product.getAll()).toEqual([]);
  });
});

// ── add ─────────────────────────────────────────────────────
describe('Product.add()', () => {
  test('creates product with auto-incremented id', () => {
    const p = Product.add(SAMPLE);
    expect(p.id).toBeGreaterThan(0);
    expect(p.name).toBe('Test Product');
    expect(p.price).toBe(19.99);
    expect(p.desc).toBe('Test desc.');
  });

  test('defaults image when empty string', () => {
    const p = Product.add({ ...SAMPLE, image: '' });
    expect(p.image).toBe('/images/backpack.svg');
  });

  test('badge becomes null when empty string', () => {
    const p = Product.add({ ...SAMPLE, badge: '' });
    expect(p.badge).toBeNull();
  });

  test('badge becomes null when omitted', () => {
    const { badge, ...rest } = SAMPLE;
    const p = Product.add(rest);
    expect(p.badge).toBeNull();
  });

  test('preserves existing products when adding', () => {
    const before = Product.getAll().length;
    Product.add(SAMPLE);
    expect(Product.getAll()).toHaveLength(before + 1);
  });

  test('trims name and desc', () => {
    const p = Product.add({ ...SAMPLE, name: '  spaced  ', desc: '  desc  ' });
    expect(p.name).toBe('spaced');
    expect(p.desc).toBe('desc');
  });

  test('converts price to number', () => {
    const p = Product.add({ ...SAMPLE, price: '42.50' });
    expect(p.price).toBe(42.5);
  });
});

// ── update ──────────────────────────────────────────────────
describe('Product.update()', () => {
  let added;
  beforeEach(() => { added = Product.add(SAMPLE); });

  test('updates single field', () => {
    const updated = Product.update(added.id, { name: 'Updated' });
    expect(updated.name).toBe('Updated');
    expect(updated.price).toBe(19.99);
  });

  test('updates multiple fields', () => {
    const updated = Product.update(added.id, { name: 'U', price: 9.99, badge: 'Sale' });
    expect(updated.name).toBe('U');
    expect(updated.price).toBe(9.99);
    expect(updated.badge).toBe('Sale');
  });

  test('converts price to number on update', () => {
    const updated = Product.update(added.id, { price: '14.50' });
    expect(updated.price).toBe(14.5);
  });
  test('empty badge string becomes null on update', () => {
    const updated = Product.update(added.id, { badge: '' });
    expect(updated.badge).toBeNull();
  });

  test('throws when product not found', () => {
    expect(() => Product.update(99999, { name: 'x' })).toThrow('Product not found.');
  });

  test('ignores fields not in allowed list', () => {
    const updated = Product.update(added.id, { name: 'Ok', extra: 'ignored' });
    expect(updated.name).toBe('Ok');
    expect(updated.extra).toBeUndefined();
  });

  test('persists update to disk', () => {
    Product.update(added.id, { name: 'Persisted' });
    const reloaded = Product.getById(added.id);
    expect(reloaded.name).toBe('Persisted');
  });
});

// ── delete ──────────────────────────────────────────────────
describe('Product.delete()', () => {
  let added;
  beforeEach(() => { added = Product.add(SAMPLE); });

  test('removes product and returns it', () => {
    const removed = Product.delete(added.id);
    expect(removed.id).toBe(added.id);
    expect(Product.getById(added.id)).toBeUndefined();
  });

  test('persists deletion to disk', () => {
    Product.delete(added.id);
    const reloaded = Product.getAll();
    expect(reloaded.find(p => p.id === added.id)).toBeUndefined();
  });

  test('throws when product not found', () => {
    expect(() => Product.delete(99999)).toThrow('Product not found.');
  });

  test('works with string id', () => {
    Product.delete(String(added.id));
    expect(Product.getById(added.id)).toBeUndefined();
  });
});
