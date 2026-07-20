import "./globals.css";
// import ClientProviders from "./components/client-providers";

export const metadata = {
  title: "Habib Rice Corporation",
  description: "Habib Rice Corporation - IMS",
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
