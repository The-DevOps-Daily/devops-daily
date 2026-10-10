import { describe, it, expect } from 'vitest';
import { runMongo, type RunResult } from '@/lib/games/mongo-sim-engine';

const ids = (result: RunResult) => {
  if (result.kind !== 'docs') throw new Error(`expected docs, got ${JSON.stringify(result)}`);
  return result.docs.map((doc) => doc._id);
};

describe('dot paths through arrays', () => {
  it('matches when any array element matches', () => {
    expect(ids(runMongo('db.orders.find({ "items.productId": 3 })'))).toEqual([1002, 1006, 1011]);
  });

  it('applies operators to each element', () => {
    expect(ids(runMongo('db.orders.find({ "items.quantity": { $gte: 5 } })'))).toEqual([
      1004, 1010,
    ]);
    expect(ids(runMongo('db.orders.find({ "items.productId": { $in: [5, 9] } })'))).toEqual([
      1002, 1005, 1008, 1009,
    ]);
  });

  it('treats $ne and $nin as "no element matches"', () => {
    const withoutMonitor = ids(runMongo('db.orders.find({ "items.productId": { $ne: 3 } })'));
    expect(withoutMonitor).toHaveLength(9);
    expect(withoutMonitor).not.toContain(1002);
    expect(
      ids(runMongo('db.orders.find({ "items.productId": { $nin: [3, 4, 5, 6, 9] } })'))
    ).toEqual([1001, 1007]);
  });

  it('supports a numeric index into the array', () => {
    expect(ids(runMongo('db.orders.find({ "items.0.productId": 3 })'))).toEqual([1002, 1006, 1011]);
    expect(ids(runMongo('db.orders.find({ "items.1.productId": 9 })'))).toEqual([1002, 1008]);
  });

  it('counts and aggregates with the same matching', () => {
    expect(runMongo('db.orders.countDocuments({ "items.productId": 3 })')).toEqual({
      kind: 'value',
      value: 3,
    });
    expect(
      runMongo('db.orders.aggregate([{ $match: { "items.productId": 8 } }, { $count: "n" }])')
    ).toEqual({
      kind: 'docs',
      docs: [{ n: 2 }],
    });
  });

  it('keeps plain field matching unchanged', () => {
    expect(ids(runMongo('db.customers.find({ country: "Canada" })'))).toEqual([4, 8]);
    expect(ids(runMongo('db.customers.find({ nickname: { $exists: false } })'))).toHaveLength(8);
  });
});

describe('BSON equality', () => {
  it('compares arrays and embedded documents by value', () => {
    expect(ids(runMongo('db.orders.find({ items: [{ productId: 3, quantity: 2 }] })'))).toEqual([
      1006,
    ]);
    expect(ids(runMongo('db.orders.find({ items: { productId: 3, quantity: 2 } })'))).toEqual([
      1006,
    ]);
    const notThatArray = ids(
      runMongo('db.orders.find({ items: { $ne: [{ productId: 3, quantity: 2 }] } })')
    );
    expect(notThatArray).toHaveLength(11);
    expect(notThatArray).not.toContain(1006);
    expect(
      ids(runMongo('db.orders.find({ items: { $nin: [[{ productId: 5, quantity: 1 }]] } })'))
    ).not.toContain(1005);
    expect(
      ids(runMongo('db.orders.find({ items: { $in: [[{ productId: 5, quantity: 1 }]] } })'))
    ).toEqual([1005, 1009]);
  });

  it('requires embedded document fields in the same order', () => {
    expect(ids(runMongo('db.orders.find({ items: { quantity: 2, productId: 3 } })'))).toEqual([]);
  });

  it('only compares values of the same type with range operators', () => {
    expect(ids(runMongo('db.orders.find({ items: { $gt: 5 } })'))).toEqual([]);
  });
});

describe('null and missing fields', () => {
  it('matches a missing field with null', () => {
    expect(ids(runMongo('db.customers.find({ nickname: null })'))).toHaveLength(8);
    expect(ids(runMongo('db.orders.find({ "items.missing": { $eq: null } })'))).toHaveLength(12);
    expect(ids(runMongo('db.orders.find({ "items.missing": { $in: [null] } })'))).toHaveLength(12);
  });

  it('excludes a missing field from $ne null and $nin [null]', () => {
    expect(ids(runMongo('db.orders.find({ "items.missing": { $ne: null } })'))).toEqual([]);
    expect(ids(runMongo('db.orders.find({ "items.missing": { $nin: [null] } })'))).toEqual([]);
    expect(ids(runMongo('db.customers.find({ country: { $ne: null } })'))).toHaveLength(8);
  });
});
