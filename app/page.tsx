"use client";

import { useMemo, useState } from "react";

type Product = { product_code: string; product_name: string; price: number };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function Home() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");

  // 🛒 購入リスト（同一商品でも行を分けて追加）
  const [cart, setCart] = useState<Product[]>([]);

  // モーダル（購入結果の合計金額を表示：税込のまま）
  const [showModal, setShowModal] = useState(false);
  const [purchaseTotal, setPurchaseTotal] = useState(0);

  // 小計（合計）※税込価格をそのまま合算
  const subtotal = useMemo(() => cart.reduce((s, i) => s + (i.price || 0), 0), [cart]);

  // 商品検索
  const handleSearch = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setProduct(null);

    try {
      const res = await fetch(`${API_BASE}/product/${encodeURIComponent(code.trim())}`);
      if (res.status === 404) {
        setError("商品がマスタ未登録です。");
      } else if (!res.ok) {
        setError(`HTTPエラー: ${res.status}`);
      } else {
        const data = (await res.json()) as Product;
        setProduct(data);
      }
    } catch {
      setError("サーバー接続に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // 追加（同一商品もそのまま行追加）
  const handleAddToCart = () => {
    if (!product) return;
    setCart((prev) => [...prev, { ...product }]);
    // 仕様：②③④をクリア
    setProduct(null);
    setCode("");
    setError("");
  };

  // 削除（取り消し）
  const handleRemove = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // 購入（/purchase POST → 合計モーダル → OKでクリア）
  const handlePurchase = async () => {
    if (cart.length === 0) return;

    const payload = {
      cashier_code: "", // 空ならバックで '9999999999'
      store_code: "30",
      pos_id: "90",
      items: cart.map((c) => ({
        product_code: c.product_code,
        product_name: c.product_name,
        price: c.price, // 税込価格をそのまま渡す
      })),
    };

    try {
      const res = await fetch(`${API_BASE}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json(); // { success, total_amount, transaction_id }
        setPurchaseTotal(Number(data?.total_amount ?? subtotal)); // 税込合計をそのまま表示
        setShowModal(true);
      } else {
        // 障害時もフロントで小計（税込）を提示（業務継続）
        setPurchaseTotal(subtotal);
        setShowModal(true);
      }
    } catch {
      setPurchaseTotal(subtotal);
      setShowModal(true);
    }
  };

  // モーダルOK → ②③④,⑥の内容をクリア
  const closeAndClear = () => {
    setShowModal(false);
    setCode("");
    setProduct(null);
    setError("");
    setCart([]);
    setPurchaseTotal(0);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-10 px-4">
      <h1 className="text-xl font-bold mb-6">Web POS（モバイル）</h1>

      {/* ② コード入力 ＆ ① 読み込みボタン */}
      <div className="flex gap-2 mb-6 w-full max-w-sm">
        <input
          type="text"
          placeholder="商品コードを入力"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-lg"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          inputMode="numeric"
          pattern="[0-9]*"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "検索中..." : "読み込み"}
        </button>
      </div>

      {/* ③ 名称/コード/単価 の表示エリア */}
      <div className="w-full max-w-sm bg-white border rounded-lg p-4 shadow-sm">
        {error && <p className="text-red-500 font-medium">{error}</p>}

        {product && (
          <div className="space-y-2">
            <p>
              <span className="font-semibold">商品名：</span> {product.product_name}
            </p>
            <p>
              <span className="font-semibold">商品コード：</span> {product.product_code}
            </p>
            <p>
              <span className="font-semibold">単価：</span> {product.price}円（税込）
            </p>

            {/* ④ 追加ボタン */}
            <button
              onClick={handleAddToCart}
              className="mt-3 w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              追加
            </button>
          </div>
        )}

        {!error && !product && (
          <p className="text-gray-500 text-sm">商品コードを入力して「読み込み」を押してください。</p>
        )}
      </div>

      {/* 🧾 購入リスト（製品名と税込金額のみ表示、削除ボタン実装） */}
      <div className="mt-8 w-full max-w-sm bg-white border rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">購入リスト</h2>
          <div className="text-sm">小計（税込）：<b>{subtotal}</b>円</div>
        </div>

        {cart.length === 0 ? (
          <p className="text-gray-500 text-sm">まだ商品が追加されていません。</p>
        ) : (
          <ul className="space-y-2">
            {cart.map((item, idx) => (
              <li key={idx} className="flex justify-between items-center border-b pb-1 text-sm">
                <span className="truncate font-semibold">{item.product_name}</span>
                <div className="flex items-center gap-2">
                  <span>{item.price}円</span>
                  <button
                    onClick={() => handleRemove(idx)}
                    className="border border-red-500 text-red-600 rounded px-2 py-1 text-xs hover:bg-red-50"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ⑥ 購入ボタン（押下→合計のポップアップ） */}
      <div className="sticky bottom-0 w-full max-w-sm bg-white border-t mt-6 p-4">
        <button
          onClick={handlePurchase}
          disabled={cart.length === 0}
          className="w-full bg-emerald-600 text-white px-4 py-3 rounded-xl text-lg font-semibold hover:bg-emerald-700 disabled:bg-gray-400"
        >
          購入
        </button>
      </div>

      {/* 合計金額ポップアップ（税込） */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
          onClick={closeAndClear}
        >
          <div
            className="w-full max-w-xs bg-white rounded-xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3">お会計</h3>
            <p className="mb-4">
              合計金額（税込）：<b className="text-2xl">{purchaseTotal}円</b>
            </p>
            <button
              onClick={closeAndClear}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  );
}