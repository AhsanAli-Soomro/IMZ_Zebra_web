"use client";

import { useMemo, useState } from "react";

export default function ProfitLossCalculator() {
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("");
  const [taxPercent, setTaxPercent] = useState("");
  const [extraCost, setExtraCost] = useState("");
  const [desiredProfitPercent, setDesiredProfitPercent] = useState("");

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const result = useMemo(() => {
    const cp = Number(costPrice);
    const sp = Number(sellingPrice);
    const qty = Number(quantity);
    const disc = Number(discount) || 0;
    const tax = Number(taxPercent) || 0;
    const expense = Number(extraCost) || 0;
    const desiredProfit = Number(desiredProfitPercent) || 0;

    const errors = [];

    if (!costPrice || cp <= 0) {
      errors.push("Cost price required hai aur 0 se zyada honi chahiye.");
    }

    if (!sellingPrice || sp <= 0) {
      errors.push("Selling price required hai aur 0 se zyada honi chahiye.");
    }

    if (!quantity || qty <= 0) {
      errors.push("Quantity required hai aur 1 ya us se zyada honi chahiye.");
    }

    if (disc < 0) {
      errors.push("Discount negative nahi ho sakta.");
    }

    if (tax < 0) {
      errors.push("Tax percentage negative nahi ho sakta.");
    }

    if (expense < 0) {
      errors.push("Extra cost negative nahi ho sakti.");
    }

    if (desiredProfit < 0) {
      errors.push("Desired profit percentage negative nahi ho sakta.");
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
      };
    }

    const totalCost = cp * qty;
    const totalSaleBeforeDiscount = sp * qty;

    const discountAmount = disc;
    const saleAfterDiscount = Math.max(totalSaleBeforeDiscount - discountAmount, 0);

    const taxAmount = (saleAfterDiscount * tax) / 100;
    const finalSale = saleAfterDiscount + taxAmount;

    const finalCost = totalCost + expense;
    const profitOrLoss = finalSale - finalCost;

    const profitMargin =
      finalSale > 0 ? (profitOrLoss / finalSale) * 100 : 0;

    const markup =
      finalCost > 0 ? (profitOrLoss / finalCost) * 100 : 0;

    const suggestedSellingPricePerUnit =
      cp + expense / qty + ((cp + expense / qty) * desiredProfit) / 100;

    const suggestedTotalSale = suggestedSellingPricePerUnit * qty;

    const status =
      profitOrLoss > 0
        ? "Profit"
        : profitOrLoss < 0
        ? "Loss"
        : "No Profit No Loss";

    return {
      isValid: true,
      totalCost,
      totalSaleBeforeDiscount,
      discountAmount,
      saleAfterDiscount,
      taxAmount,
      finalSale,
      extraCost: expense,
      finalCost,
      profitOrLoss,
      profitMargin,
      markup,
      suggestedSellingPricePerUnit,
      suggestedTotalSale,
      status,
    };
  }, [
    costPrice,
    sellingPrice,
    quantity,
    discount,
    taxPercent,
    extraCost,
    desiredProfitPercent,
  ]);

  const resetForm = () => {
    setCostPrice("");
    setSellingPrice("");
    setQuantity("1");
    setDiscount("");
    setTaxPercent("");
    setExtraCost("");
    setDesiredProfitPercent("");
  };

  return (
    <div className="w-full max-w-6xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Profit / Loss Calculator
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            IMS ke liye cost, sale, discount, tax, expense aur profit margin
            calculate karein.
          </p>
        </div>

        {result?.isValid && (
          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
              result.status === "Profit"
                ? "bg-green-100 text-green-700"
                : result.status === "Loss"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {result.status}
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InputField
          label="Cost Price / Unit"
          value={costPrice}
          onChange={setCostPrice}
          placeholder="e.g. 1000"
        />

        <InputField
          label="Selling Price / Unit"
          value={sellingPrice}
          onChange={setSellingPrice}
          placeholder="e.g. 1200"
        />

        <InputField
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          placeholder="e.g. 5"
        />

        <InputField
          label="Discount Amount"
          value={discount}
          onChange={setDiscount}
          placeholder="e.g. 500"
        />

        <InputField
          label="Tax / GST %"
          value={taxPercent}
          onChange={setTaxPercent}
          placeholder="e.g. 18"
        />

        <InputField
          label="Extra Cost"
          value={extraCost}
          onChange={setExtraCost}
          placeholder="Delivery, packing etc."
        />

        <InputField
          label="Desired Profit %"
          value={desiredProfitPercent}
          onChange={setDesiredProfitPercent}
          placeholder="e.g. 25"
        />
      </div>

      {!result?.isValid && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-semibold text-red-700">
            Please fix these errors:
          </h3>

          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-600">
            {result?.errors?.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {result?.isValid && (
        <>
          <div className="mt-6 rounded-2xl bg-gray-50 p-5">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Sale Summary
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <ResultCard
                label="Total Cost"
                value={formatCurrency(result.totalCost)}
              />

              <ResultCard
                label="Total Sale"
                value={formatCurrency(result.totalSaleBeforeDiscount)}
              />

              <ResultCard
                label="Discount"
                value={formatCurrency(result.discountAmount)}
              />

              <ResultCard
                label="Sale After Discount"
                value={formatCurrency(result.saleAfterDiscount)}
              />

              <ResultCard
                label="Tax Amount"
                value={formatCurrency(result.taxAmount)}
              />

              <ResultCard
                label="Final Sale"
                value={formatCurrency(result.finalSale)}
              />

              <ResultCard
                label="Extra Cost"
                value={formatCurrency(result.extraCost)}
              />

              <ResultCard
                label="Final Cost"
                value={formatCurrency(result.finalCost)}
              />
            </div>
          </div>

          <div
            className={`mt-6 rounded-2xl p-5 ${
              result.status === "Profit"
                ? "bg-green-50"
                : result.status === "Loss"
                ? "bg-red-50"
                : "bg-gray-50"
            }`}
          >
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Profit / Loss Result
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <ResultCard
                label={
                  result.status === "Loss"
                    ? "Loss Amount"
                    : result.status === "Profit"
                    ? "Profit Amount"
                    : "Amount"
                }
                value={formatCurrency(Math.abs(result.profitOrLoss))}
              />

              <ResultCard
                label="Profit Margin"
                value={`${result.profitMargin.toFixed(2)}%`}
              />

              <ResultCard
                label="Markup"
                value={`${result.markup.toFixed(2)}%`}
              />

              <ResultCard
                label="Status"
                value={result.status}
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Suggested Selling Price
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <ResultCard
                label="Suggested Price / Unit"
                value={formatCurrency(result.suggestedSellingPricePerUnit)}
              />

              <ResultCard
                label="Suggested Total Sale"
                value={formatCurrency(result.suggestedTotalSale)}
              />
            </div>

            <p className="mt-3 text-sm text-blue-700">
              Ye suggestion cost price, extra cost aur desired profit percentage
              ke basis par calculate ho raha hai.
            </p>
          </div>
        </>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={resetForm}
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Reset Calculator
        </button>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function ResultCard({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}