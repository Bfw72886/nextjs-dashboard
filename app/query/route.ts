import pg from 'pg';
const { Client } = pg;
const client = new Client();

async function listInvoices() {
  const data = await client.query(`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `);
  // const data = await client.query(`
  //   DROP TABLE invoices;
  // `);
  return data;
}

export async function GET() {
  try {
    await client.connect();

    await client.query(`BEGIN`);
    const invoices = await listInvoices();
    await client.query(`COMMIT`);
    await client.end();

    return Response.json(invoices);
  } catch (error) {
    await client.query(`ROLLBACK`);
    await client.end();

    return Response.json({ error }, { status: 500 });
  }
}
