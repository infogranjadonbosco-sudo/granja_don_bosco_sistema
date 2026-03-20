import { useCart } from "../context/CartContext"

export default function ProductCard({ product }) {
  const { addToCart } = useCart()

  return (
    <div className="Card">
      <img
        src={product.image || "https://via.placeholder.com/150"}
        alt={product.name}
      />

      <h3>{product.name}</h3>

      <p>${product.price}</p>

      <button onClick={() => addToCart(product)}>
        Agregar
      </button>
    </div>
  )
}
