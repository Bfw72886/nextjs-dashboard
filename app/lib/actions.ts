'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import pg from 'pg';
const { Client } = pg;
const client = new Client();

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  await client.connect();
  await client.query(`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES ('${customerId}', ${amountInCents}, '${status}', '${date}');
    `);
  await client.end();

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(id: String, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  const amountInCents = amount * 100;

  await client.connect();
  await client.query(`
    UPDATE invoices
    SET customer_id = '${customerId}', amount = ${amountInCents}, status = '${status}'
    WHERE id = '${id}'
    `);
  await client.end();

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  await client.connect();
  await client.query(`
    DELETE FROM invoices
    WHERE id = '${id}'
    `);
  await client.end();

  revalidatePath('/dashboard/invoices');
}
