import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getShop, getProducts, deleteProduct, getImageUrl } from "../../api";
import AddProduct from "../components/AddProduct";
import EditShop from "../components/EditShop";
import "./ShopPage.css";

const PLACEHOLDER = "https://placehold.co/800x400/e8e0f0/6c63ff?text=No+Image";

function StarRating({ rating }) {
  const stars = Math.round(rating ?? 0);
  return (
    <span className="shop-page-stars" title={`${rating ?? 0} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < stars ? "star filled" : "star"}>
          ★
        </span>
      ))}
      <span className="rating-num">{rating ? Number(rating).toFixed(1) : "New"}</span>
    </span>
  );
}

export default function ShopPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showEditShop, setShowEditShop] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const userId = localStorage.getItem("user_id");
  const isOwner = shop && userId && String(shop.owner_id) === String(userId);

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
      <div className="shop-page">
        <div className="shop-page-loading">Loading shop...</div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="shop-page">
        <div className="shop-page-error">
          <h2>Shop not found</h2>
          <Link to="/feed">← Back to Feed</Link>
        </div>
      </div>
    );
  }

  const mainImage =
    getImageUrl(shop.shop_images?.[0]?.image_url) ?? PLACEHOLDER;
  const owner = shop.profiles;

  return (
    <div className="shop-page">
      <header className="shop-page-header">
        <button className="shop-page-back" onClick={() => navigate("/feed")}>
          ← Back to Feed
        </button>
      </header>

      <div className="shop-page-hero">
        <img
          src={mainImage}
          alt={shop.title}
          className="shop-page-image"
          onError={(e) => {
            e.target.src = PLACEHOLDER;
          }}
        />
        {shop.category && (
          <span className="shop-page-category">{shop.category}</span>
        )}
      </div>

      <main className="shop-page-main">
        <div className="shop-page-info">
          <div className="shop-page-title-row">
            <h1>{shop.title}</h1>
            {isOwner && (
              <button
                type="button"
                className="edit-shop-btn"
                onClick={() => setShowEditShop(true)}
              >
                Edit Shop
              </button>
            )}
          </div>

          {successMessage && (
            <p className="shop-page-success" role="status">
              {successMessage}
            </p>
          )}

          <div className="shop-page-meta">
            <StarRating rating={shop.average_rating} />
            {owner && (
              <div className="shop-page-owner">
                {owner.profile_image ? (
                  <img src={owner.profile_image} alt={owner.name} />
                ) : (
                  <span className="owner-initial">
                    {(owner.name ?? "U")[0].toUpperCase()}
                  </span>
                )}
                <span>{owner.name}</span>
              </div>
            )}
          </div>

          {shop.phone && (
            <p className="shop-page-phone">
              <span className="phone-label">Contact:</span>{" "}
              <a href={`tel:${shop.phone}`}>{shop.phone}</a>
            </p>
          )}

          <p className="shop-page-description">
            {shop.description || "No description provided."}
          </p>

          {shop.tags?.length > 0 && (
            <div className="shop-page-tags">
              {shop.tags.map((tag, i) => (
                <span key={i} className="shop-page-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <section className="shop-page-products">
          <div className="products-header">
            <h2>Products & Services</h2>
            {isOwner && (
              <button
                className="add-product-btn"
                onClick={() => setShowAddProduct(true)}
              >
                + Add Product
              </button>
            )}
          </div>

          {products.length === 0 ? (
            <p className="products-empty">No products listed yet.</p>
          ) : (
            <div className="products-grid">
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  <h3>{product.title}</h3>
                  <p className="product-desc">
                    {product.description || "No description."}
                  </p>
                  {product.price_or_range && (
                    <p className="product-price">{product.price_or_range}</p>
                  )}
                  {isOwner && (
                    <button
                      className="product-delete-btn"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
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
  );
}
