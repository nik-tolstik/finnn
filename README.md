This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, set up your environment variables:

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Generate a NextAuth secret (required for production):
```bash
openssl rand -base64 32
```

3. Update the `.env` file with your MongoDB connection string and NextAuth secret:
```env
MONGODB_URI="mongodb://localhost:27017/finhub"
NEXTAUTH_URL="http://localhost:9999"
NEXTAUTH_SECRET="paste-generated-secret-here"
UPLOADTHING_SECRET="your-uploadthing-secret-here"
```

**Note:** For production, add `UPLOADTHING_SECRET` to use cloud storage for avatar uploads. You can use your `UPLOADTHING_TOKEN` as the value for `UPLOADTHING_SECRET`. In development, files are stored locally in `public/uploads/avatars/`.

3. Generate Prisma client and push the schema:
```bash
npm run db:generate
npm run db:push
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:9999](http://localhost:9999) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
