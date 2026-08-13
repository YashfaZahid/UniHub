import { useEffect, useState, useMemo } from "react";

import { useParams, useNavigate, Link } from "react-router-dom";

import {

  getShop,

  getProducts,

  deleteProduct,

  startConversation,

} from "../../api";

import { getShopCoverUrl, getProfileImageUrl, handleImageError, SHOP_PLACEHOLDER, AVATAR_PLACEHOLDER } from "../utils/images";

import AddProduct from "../components/AddProduct";

import EditShop from "../components/EditShop";

import ProductCard from "../components/ProductCard";

import AppLayout from "../components/AppLayout";

import "./ShopPage.css";



export default function ShopPage() {

  const { id } = useParams();

  const navigate = useNavigate();

  const [shop, setShop] = useState(null);

  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);

  const [showAddProduct, setShowAddProduct] = useState(false);

  const [showEditShop, setShowEditShop] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");

  const [actionError, setActionError] = useState("");

  const [messageLoading, setMessageLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [sortBy, setSortBy] = useState("newest");



  const userId = localStorage.getItem("user_id");

  const isOwner = Boolean(shop?.owner_id && userId && String(shop.owner_id) === String(userId));

  const showMessageSeller = shop && !isOwner;



  useEffect(() => {

    const load = async () => {

      setLoading(true);

      try {

        const [shopData, productsData] = await Promise.all([

          getShop(id),

          getProducts(id),

        ]);

        setShop(shopData);

        setProducts(productsData);

      } catch (err) {

        console.error(err);

      } finally {

        setLoading(false);

      }

    };

    load();

  }, [id]);



  const filteredProducts = useMemo(() => {

    let list = [...products];

    if (search.trim()) {

      const q = search.toLowerCase();

      list = list.filter(

        (p) =>

          p.title?.toLowerCase().includes(q) ||

          p.description?.toLowerCase().includes(q)

      );

    }

    if (sortBy === "price_asc") {

      list.sort((a, b) => parseFloat(a.price_or_range) - parseFloat(b.price_or_range));

    } else if (sortBy === "price_desc") {

      list.sort((a, b) => parseFloat(b.price_or_range) - parseFloat(a.price_or_range));

    }

    return list;

  }, [products, search, sortBy]);



  const handleMessageSeller = async () => {

    setActionError("");

    if (!userId) {

      navigate("/login");

      return;

    }



    setMessageLoading(true);

    try {

      const conv = await startConversation({ shop_id: id });

      if (!conv?.id) {

        throw new Error("No conversation returned");

      }

      navigate(`/messages?conversation=${conv.id}`);

    } catch (err) {

      const msg =

        err.response?.data?.error ||

        err.message ||

        "Unable to start conversation. Please try again.";

      setActionError(msg);

      if (err.response?.status === 401) {

        navigate("/login");

      }

    } finally {

      setMessageLoading(false);

    }

  };



  const handleProductAdded = (product) => {

    setProducts((prev) => [product, ...prev]);

  };



  const handleShopUpdated = (updatedShop) => {

    setShop(updatedShop);

    setShowEditShop(false);

    setSuccessMessage("Shop updated successfully!");

    setTimeout(() => setSuccessMessage(""), 4000);

  };



  const handleDeleteProduct = async (productId) => {

    if (!window.confirm("Delete this product?")) return;

    try {

      await deleteProduct(productId);

      setProducts((prev) => prev.filter((p) => p.id !== productId));

    } catch (err) {

      alert(err.response?.data?.error || "Failed to delete product");

    }

  };



  if (loading) {

    return (

      <AppLayout>

        <div className="shop-page">

          <div className="shop-page-loading">Loading shop…</div>

        </div>

      </AppLayout>

    );

  }



  if (!shop) {

    return (

      <AppLayout>

        <div className="shop-page">

          <div className="shop-page-error">

            <h2>Shop not found</h2>

            <Link to="/feed">← Back to Feed</Link>

          </div>

        </div>

      </AppLayout>

    );

  }



  const mainImage = getShopCoverUrl(shop);

  const owner = shop.profiles;



  return (

    <AppLayout>

      <div className="shop-page">

        <header className="shop-page-header">

          <button type="button" className="btn btn-ghost shop-page-back" onClick={() => navigate("/feed")}>

            ← Back to Feed

          </button>

        </header>



        <div className="shop-page-hero">

          <img

            src={mainImage}

            alt={shop.title}

            className="shop-page-image"

            onError={(e) => handleImageError(e, SHOP_PLACEHOLDER)}

          />

        </div>



        <main className="shop-page-main">

          <div className="shop-page-info">

            <div className="shop-page-title-row">

              <h1>{shop.title}</h1>

              {isOwner && (

                <div className="shop-page-owner-actions">

                  <button

                    type="button"

                    className="btn btn-ghost shop-insights-btn"

                    onClick={() => navigate(`/shop/${id}/insights`)}

                  >

                    Insights


                  </button>

                  <button type="button" className="btn btn-secondary edit-shop-btn" onClick={() => setShowEditShop(true)}>

                    Edit Shop

                  </button>

                </div>

              )}

            </div>



            {successMessage && <p className="shop-page-success" role="status">{successMessage}</p>}

            {actionError && (

              <p className="shop-page-action-error alert alert-error" role="alert">

                {actionError}

              </p>

            )}



            <div className="shop-stats-row">

              <span>{products.length} product{products.length !== 1 ? 's' : ''}</span>

            </div>



            <div className="shop-page-meta">

              {owner && (

                <button

                  type="button"

                  className="shop-page-owner shop-owner-link"

                  onClick={() => navigate(`/profile/${shop.owner_id}`)}

                >

                  <img

                    src={getProfileImageUrl(owner)}

                    alt={owner.name}

                    className="avatar avatar-md"

                    onError={(e) => handleImageError(e, AVATAR_PLACEHOLDER)}

                  />

                  <span>{owner.name}</span>

                </button>

              )}

            </div>



            {showMessageSeller && (

              <div className="shop-page-actions marketplace-actions">

                <button

                  type="button"

                  className="marketplace-btn message-seller-btn"

                  onClick={handleMessageSeller}

                  disabled={messageLoading}

                >

                  {messageLoading ? "Opening chat…" : "Message Seller"}

                </button>

              </div>

            )}



            {shop.phone && (

              <p className="shop-page-phone">

                <span className="phone-label">Contact:</span>{" "}

                <a href={`tel:${shop.phone}`}>{shop.phone}</a>

              </p>

            )}



            <p className="shop-page-description">{shop.description || "No description provided."}</p>



            {shop.tags?.length > 0 && (

              <div className="shop-page-tags">

                {shop.tags.map((tag, i) => (

                  <span key={i} className="shop-page-tag">{tag}</span>

                ))}

              </div>

            )}

          </div>



          <section className="shop-page-products">

            <div className="products-header">

              <h2>Products & Services</h2>

              {isOwner && (

                <button type="button" className="btn btn-primary add-product-btn" onClick={() => setShowAddProduct(true)}>

                  + Add Product

                </button>

              )}

            </div>



            <div className="shop-products-toolbar">

              <input

                type="search"

                placeholder="Search products…"

                value={search}

                onChange={(e) => setSearch(e.target.value)}

              />

              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>

                <option value="newest">Newest</option>

                <option value="price_asc">Price: Low to High</option>

                <option value="price_desc">Price: High to Low</option>

              </select>

            </div>



            {filteredProducts.length === 0 ? (

              <p className="products-empty">No products listed yet.</p>

            ) : (

              <div className="products-grid">

                {filteredProducts.map((product) => (

                  <ProductCard

                    key={product.id}

                    product={product}

                    isOwner={isOwner}

                    onDelete={() => handleDeleteProduct(product.id)}

                  />

                ))}

              </div>

            )}

          </section>

        </main>



        {showAddProduct && (

          <AddProduct

            shopId={id}

            onProductAdded={handleProductAdded}

            onClose={() => setShowAddProduct(false)}

          />

        )}



        {showEditShop && (

          <EditShop

            shop={shop}

            shopId={id}

            onUpdated={handleShopUpdated}

            onClose={() => setShowEditShop(false)}

          />

        )}

      </div>

    </AppLayout>

  );

}

