import "./globals.css";
// import ClientProviders from "./components/client-providers";

export const metadata = {
  title: "Zebra IMS",
  description: "Zebra IMS - Inventory & Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* <ClientProviders> */}
          {children}
          {/* </ClientProviders> */}
      </body>
    </html>
  );
}
