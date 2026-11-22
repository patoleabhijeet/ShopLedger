'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// gstRate is explicitly undefined to model persisted order lines: HSN is stored,
// but the invoice's current calculation falls back to the configured default.
function item(name, price, qty, hsn) {
  return { name, price, qty, hsn, gstRate: undefined };
}

function order(id, items, coupon) {
  return { id, items, coupon };
}

function assertInvoiceFigures(actual, expected) {
  assert.deepEqual({
    subtotal: actual.subtotal,
    discount: actual.discount,
    tax: actual.tax,
    cgst: actual.cgst,
    sgst: actual.sgst,
    total: actual.total,
    rows: actual.rows.map(row => ({
      name: row.name,
      sku: row.sku,
      hsn: row.hsn,
      qty: row.qty,
      price: row.price,
      gstPercent: row.gstPercent,
      line: row.line,
      lineTax: row.lineTax
    }))
  }, expected);
}

function assertCheckoutFigures(actual, expected) {
  assert.deepEqual(
    { subtotal: actual.subtotal, discount: actual.discount, tax: actual.tax, total: actual.total },
    expected
  );
}

test('Invoice uses configured HSN rates on #1001 lines', () => {
  const items = [
    item('Unpolished Toor Dal 1kg', 165, 1, '0713'),
    item('A2 Gir Cow Ghee 500ml', 450, 1, '0405')
  ];
  const currentOrder = order(1001, items, '');
  const invoiceFigures = invoice.computeInvoiceFigures(currentOrder);
  const checkoutFigures = pricing.computeTotals(items, '');

  assertInvoiceFigures(invoiceFigures, {
    subtotal: 615,
    discount: 0,
    tax: 62.25,
    cgst: 31.13,
    sgst: 31.12,
    total: 677.25,
    rows: [
      { name: 'Unpolished Toor Dal 1kg', sku: '-', hsn: '0713', qty: 1, price: 165, gstPercent: 5, line: 165, lineTax: 8.25 },
      { name: 'A2 Gir Cow Ghee 500ml', sku: '-', hsn: '0405', qty: 1, price: 450, gstPercent: 12, line: 450, lineTax: 54 }
    ]
  });
  assertCheckoutFigures(checkoutFigures, { subtotal: 615, discount: 0, tax: 62.25, total: 677.25 });
});

test('Invoice matches checkout SAVE10 figures for #1002', () => {
  const items = [
    item('Indrayani Basmati Rice 5kg', 640, 1, '1006'),
    item('Cold-Pressed Sunflower Oil 1L', 190, 2, '1512')
  ];
  const currentOrder = order(1002, items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(currentOrder);
  const checkoutFigures = pricing.computeTotals(items, 'SAVE10');

  assertInvoiceFigures(invoiceFigures, {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    rows: [
      { name: 'Indrayani Basmati Rice 5kg', sku: '-', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Cold-Pressed Sunflower Oil 1L', sku: '-', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
    ]
  });
  assertCheckoutFigures(checkoutFigures, { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 });
});

test('Invoice applies the SAVE10 cap and post-discount tax for #1004', () => {
  const items = [item('Cold-Pressed Groundnut Oil 5L', 1120, 2, '1508')];
  const currentOrder = order(1004, items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(currentOrder);
  const checkoutFigures = pricing.computeTotals(items, 'SAVE10');

  assertInvoiceFigures(invoiceFigures, {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5,
    rows: [
      { name: 'Cold-Pressed Groundnut Oil 5L', sku: '-', hsn: '1508', qty: 2, price: 1120, gstPercent: 5, line: 2240, lineTax: 104.5 }
    ]
  });
  assertCheckoutFigures(checkoutFigures, { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 });
});

test('CURRENT BEHAVIOUR: #1008 invoice and checkout agree for undiscounted 18% lines', () => {
  const items = [
    item('Assam CTC Masala Chai 250g', 140, 1, '0902'),
    item('Kokum Sherbet Concentrate 750ml', 180, 2, '2106')
  ];
  const currentOrder = order(1008, items, '');
  const invoiceFigures = invoice.computeInvoiceFigures(currentOrder);
  const checkoutFigures = pricing.computeTotals(items, '');

  assertInvoiceFigures(invoiceFigures, {
    subtotal: 500,
    discount: 0,
    tax: 90,
    cgst: 45,
    sgst: 45,
    total: 590,
    rows: [
      { name: 'Assam CTC Masala Chai 250g', sku: '-', hsn: '0902', qty: 1, price: 140, gstPercent: 18, line: 140, lineTax: 25.2 },
      { name: 'Kokum Sherbet Concentrate 750ml', sku: '-', hsn: '2106', qty: 2, price: 180, gstPercent: 18, line: 360, lineTax: 64.8 }
    ]
  });
  assertCheckoutFigures(checkoutFigures, { subtotal: 500, discount: 0, tax: 90, total: 590 });
});

test('Invoice matches checkout HSN GST, coupon discount, tax and total for ticket orders', () => {
  const cases = [
    {
      id: 1001,
      coupon: '',
      items: [
        item('Unpolished Toor Dal 1kg', 165, 1, '0713'),
        item('A2 Gir Cow Ghee 500ml', 450, 1, '0405')
      ],
      expected: { subtotal: 615, discount: 0, tax: 62.25, cgst: 31.13, sgst: 31.12, total: 677.25,
        lines: [{ discount: 0, taxable: 165, tax: 8.25 }, { discount: 0, taxable: 450, tax: 54 }] }
    },
    {
      id: 1002,
      coupon: 'SAVE10',
      items: [
        item('Indrayani Basmati Rice 5kg', 640, 1, '1006'),
        item('Cold-Pressed Sunflower Oil 1L', 190, 2, '1512')
      ],
      expected: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9,
        lines: [{ discount: 64, taxable: 576, tax: 28.8 }, { discount: 38, taxable: 342, tax: 17.1 }] }
    },
    {
      id: 1004,
      coupon: 'SAVE10',
      items: [item('Cold-Pressed Groundnut Oil 5L', 1120, 2, '1508')],
      expected: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5,
        lines: [{ discount: 150, taxable: 2090, tax: 104.5 }] }
    },
    {
      id: 1008,
      coupon: '',
      items: [
        item('Assam CTC Masala Chai 250g', 140, 1, '0902'),
        item('Kokum Sherbet Concentrate 750ml', 180, 2, '2106')
      ],
      expected: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590,
        lines: [{ discount: 0, taxable: 140, tax: 25.2 }, { discount: 0, taxable: 360, tax: 64.8 }] }
    }
  ];

  for (const fixture of cases) {
    const actualInvoice = invoice.computeInvoiceFigures(order(fixture.id, fixture.items, fixture.coupon));
    const checkout = pricing.computeTotals(fixture.items, fixture.coupon);

    assert.deepEqual(
      { subtotal: actualInvoice.subtotal, discount: actualInvoice.discount, tax: actualInvoice.tax, cgst: actualInvoice.cgst, sgst: actualInvoice.sgst, total: actualInvoice.total },
      { subtotal: checkout.subtotal, discount: checkout.discount, tax: checkout.tax, cgst: checkout.cgst, sgst: checkout.sgst, total: checkout.total },
      `Invoice summary for order #${fixture.id}`
    );
    assert.deepEqual(
      actualInvoice.rows.map(row => ({ gstPercent: row.gstPercent, discount: row.discount, taxable: row.taxable, tax: row.lineTax })),
      checkout.lines.map(line => ({ gstPercent: line.gstPercent, discount: line.discount, taxable: line.taxable, tax: line.tax })),
      `Invoice lines for order #${fixture.id}`
    );
    assert.deepEqual(
      { subtotal: actualInvoice.subtotal, discount: actualInvoice.discount, tax: actualInvoice.tax, cgst: actualInvoice.cgst, sgst: actualInvoice.sgst, total: actualInvoice.total },
      { subtotal: fixture.expected.subtotal, discount: fixture.expected.discount, tax: fixture.expected.tax, cgst: fixture.expected.cgst, sgst: fixture.expected.sgst, total: fixture.expected.total },
      `Expected billed figures for order #${fixture.id}`
    );
    assert.deepEqual(
      actualInvoice.rows.map(row => ({ discount: row.discount, taxable: row.taxable, tax: row.lineTax })),
      fixture.expected.lines,
      `Expected line breakdown for order #${fixture.id}`
    );
  }
});
