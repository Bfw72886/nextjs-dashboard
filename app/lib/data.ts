import pg from 'pg';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoice,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

const { Pool } = pg;
const pool = new Pool();

export async function fetchRevenue(): Promise<Revenue[]> {
  const client = await pool.connect();
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await client.query(`SELECT * FROM revenue`);

    console.log('Data fetch completed after 3 seconds.');

    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  } finally {
    client.release();
  }
}

export async function fetchLatestInvoices(): Promise<LatestInvoice[]> {
  const client = await pool.connect();

  try {
    const data = await client.query(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`);

    const latestInvoices = data.rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  } finally {
    client.release();
  }
}

export async function fetchCardData() {
  const client = await pool.connect();

  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = await client.query(
      `SELECT COUNT(*) FROM invoices`
    );
    const customerCountPromise = await client.query(
      `SELECT COUNT(*) FROM customers`
    );
    const invoiceStatusPromise = await client.query(`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`);

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0].rows[0].count ?? '0');
    const numberOfCustomers = Number(data[1].rows[0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? '0');

    client.release();

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    client.release();
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
): Promise<InvoicesTable[]> {
  const client = await pool.connect();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await client.query(`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE '${`%${query}%`}' OR
        customers.email ILIKE '${`%${query}%`}' OR
        invoices.amount::text ILIKE '${`%${query}%`}' OR
        invoices.date::text ILIKE '${`%${query}%`}' OR
        invoices.status ILIKE '${`%${query}%`}'
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `);
    return invoices.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  } finally {
    client.release();
  }
}

export async function fetchInvoicesPages(query: string) {
  const client = await pool.connect();

  try {
    const count = await client.query(`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE '${`%${query}%`}' OR
      customers.email ILIKE '${`%${query}%`}' OR
      invoices.amount::text ILIKE '${`%${query}%`}' OR
      invoices.date::text ILIKE '${`%${query}%`}' OR
      invoices.status ILIKE '${`%${query}%`}'
  `);

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  } finally {
    client.release();
  }
}

export async function fetchInvoiceById(id: string): Promise<InvoiceForm> {
  const client = await pool.connect();

  try {
    const data = await client.query(`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `);

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  } finally {
    client.release();
  }
}

export async function fetchCustomers(): Promise<CustomerField[]> {
  const client = await pool.connect();

  try {
    const data = await client.query(`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `);

    const customers = data.rows;
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  } finally {
    client.release();
  }
}

export async function fetchFilteredCustomers(
  query: string
): Promise<CustomersTableType[]> {
  const client = await pool.connect();

  try {
    const data = await client.query(`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE '${`%${query}%`}' OR
        customers.email ILIKE '${`%${query}%`}'
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `);

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  } finally {
    client.release();
  }
}
