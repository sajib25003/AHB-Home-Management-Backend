import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

// Synthetic credentials and mocked persistence; never connects to a database.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'mongodb://127.0.0.1/ledger-route-check',
  JWT_SECRET: 'ledger-route-test-access-secret',
  JWT_REFRESH_SECRET: 'ledger-route-test-refresh-secret',
  JWT_ISSUER: 'ledger-route-check',
  JWT_AUDIENCE: 'ledger-route-check',
  CLIENT_URLS: 'http://localhost:3000',
});

async function run() {
  const { default: app } = await import('../src/app');
  const { UserModel } = await import('../src/app/modules/user/user.model');
  const { PropertyExpenseCategoryModel } = await import(
    '../src/app/modules/property-ledger/property-ledger.model'
  );
  const adminId = new Types.ObjectId();
  const ownerId = new Types.ObjectId();
  let role = 'superAdmin';
  let authenticatedId = adminId;
  let ownerFilter: Record<string, unknown> = {};
  let categoryFilter: Record<string, unknown> = {};
  UserModel.findOne = ((filter: Record<string, unknown>) => ({
    select: async () => {
      if (filter.role === 'owner') {
        ownerFilter = filter;
        return { _id: new Types.ObjectId(String(filter._id)) };
      }
      return { _id: authenticatedId, email: 'test@example.test', role };
    },
  })) as never;
  let seeded = 0;
  PropertyExpenseCategoryModel.bulkWrite = ((operations: unknown[]) => {
    seeded = operations.length;
    return Promise.resolve({});
  }) as never;
  PropertyExpenseCategoryModel.find = ((filter: Record<string, unknown>) => {
    categoryFilter = filter;
    return {
      sort: () => ({
        lean: async () => [{ key: 'ELECTRICITY', name: 'Electricity Bill' }],
      }),
    };
  }) as never;
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/property-ledger`;
  const token = jwt.sign({ tokenType: 'access' }, process.env.JWT_SECRET!, {
    subject: adminId.toString(),
    issuer: 'ledger-route-check',
    audience: 'ledger-route-check',
    expiresIn: '1h',
  });
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const url = `${base}/categories?ownerId=${ownerId}&includeInactive=false`;
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data[0].key, 'ELECTRICITY');
    assert.equal(String(ownerFilter._id), ownerId.toString());
    assert.equal(String(categoryFilter.ownerId), ownerId.toString());
    assert.equal(categoryFilter.isActive, true);
    assert.equal(seeded, 15);
    assert.equal((await fetch(`${base}/categories`, { headers })).status, 400);
    role = 'owner';
    authenticatedId = ownerId;
    assert.equal(
      (
        await fetch(
          `${base}/categories?ownerId=${adminId}&includeInactive=true`,
          { headers },
        )
      ).status,
      200,
    );
    assert.equal(String(categoryFilter.ownerId), ownerId.toString());
    assert.equal(categoryFilter.isActive, undefined);
    role = 'tenant';
    assert.equal((await fetch(url, { headers })).status, 403);
    // Every mounted ledger operation must reach authentication, rather than the API 404.
    for (const path of ['/templates', '/overview', '/report']) {
      assert.equal((await fetch(`${base}${path}`)).status, 401);
    }
    console.log(
      'PASS: mounted ledger HTTP routes, super admin owner selection, default categories, active filter, owner isolation and tenant denial',
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
void run();
