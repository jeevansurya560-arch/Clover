import './globals.css';

export const metadata = {
  title: 'Clover — Shared Household Workspace',
  description: 'One household. One shared workspace. Everything synchronized.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
