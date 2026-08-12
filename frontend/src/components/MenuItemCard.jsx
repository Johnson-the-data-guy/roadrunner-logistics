export default function MenuItemCard({ item, quantity, onAdd, onRemove }) {
  return (
    <div className="menu-card">
      <div className="menu-card-emoji">{item.emoji}</div>
      <div className="menu-card-body">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="menu-card-footer">
          <span className="price">${item.price.toFixed(2)}</span>
          {quantity > 0 ? (
            <div className="qty-stepper">
              <button onClick={onRemove} aria-label={`Remove one ${item.name}`}>
                −
              </button>
              <span>{quantity}</span>
              <button onClick={onAdd} aria-label={`Add one ${item.name}`}>
                +
              </button>
            </div>
          ) : (
            <button className="btn btn-accent btn-sm" onClick={onAdd}>
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
