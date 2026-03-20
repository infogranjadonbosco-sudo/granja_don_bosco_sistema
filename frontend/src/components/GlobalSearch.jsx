import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Cerrar el dropdown si haces click afuera
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      // Buscar en productos
      const { data: prods } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .limit(3);

      // Buscar en ventas (por ID truncado o completo)
      const cleanQuery = query.startsWith('#') ? query.slice(1) : query;
      
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, created_at, nombre_cliente')
        .order('created_at', { ascending: false })
        .limit(200); // Traemos más para poder filtrar localmente por código corto

      // Filtrar órdenes por el código corto (prefijo del UUID) o por nombre de cliente
      const matchedOrders = (orders || []).filter(o => 
        o.id.toLowerCase().startsWith(cleanQuery.toLowerCase()) || 
        (o.nombre_cliente && o.nombre_cliente.toLowerCase().includes(cleanQuery.toLowerCase()))
      ).slice(0, 3);

      // Buscar en usuarios (trabajadores)
      const { data: users } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, rol')
        .ilike('nombre_completo', `%${query}%`)
        .limit(3);

      let combined = [];
      if (users && users.length > 0) {
        combined = [...combined, { type: 'header', label: 'Trabajadores' }];
        users.forEach(u => combined.push({ type: 'user', data: u }));
      }
      
      if (prods && prods.length > 0) {
        combined = [...combined, { type: 'header', label: 'Productos' }];
        prods.forEach(p => combined.push({ type: 'product', data: p }));
      }

      if (matchedOrders.length > 0) {
        combined = [...combined, { type: 'header', label: 'Ventas / Recibos' }];
        matchedOrders.forEach(o => combined.push({ type: 'order', data: o }));
      }

      setResults(combined);
      setShowDropdown(combined.length > 0);
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item) => {
    setShowDropdown(false);
    setQuery('');
    
    if (item.type === 'product') {
      navigate(`/product/${item.data.id}`);
    } else if (item.type === 'user') {
      navigate(`/chat`);
    } else if (item.type === 'order') {
      // Redirigir a la nueva página de recibos con el ID seleccionado
      navigate(`/receipts?id=${item.data.id}`);
    }
  };

  const fetchOrderDetails = async (order) => {
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
    
    let msg = `📄 RECIBO DE VENTA #${order.id.toString().slice(0,6)}\n`;
    msg += `Cliente: ${order.nombre_cliente || 'Invitado'}\n`;
    msg += `Fecha: ${new Date(order.created_at).toLocaleString()}\n`;
    msg += `--------------------------\n`;
    
    if (items && items.length > 0) {
      items.forEach(it => {
        msg += `• ${it.product_name} (${it.quantity}) - $${it.price}\n`;
      });
    } else {
      msg += `(Total de la orden sin detalle - sistema anterior)\n`;
    }
    
    msg += `--------------------------\n`;
    msg += `TOTAL: $${order.total}`;
    
    alert(msg);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '20px', padding: '5px 15px', border: '1px solid rgba(0,0,0,0.1)', transition: 'all 0.3s' }}>
         <span style={{ marginRight: '8px', color: '#555' }}>🔍</span>
         <input 
           type="text" 
           value={query}
           onChange={(e) => {
             setQuery(e.target.value);
             if (!showDropdown && e.target.value.length >= 2) setShowDropdown(true);
           }}
           onFocus={() => {
             if (results.length > 0) setShowDropdown(true);
           }}
           placeholder="Buscar..." 
           style={{ border: 'none', outline: 'none', background: 'transparent', color: '#111', width: '150px', fontWeight: '500' }} 
           className="nav-search-input"
         />
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '45px',
          left: '0',
          width: '250px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          zIndex: 9999
        }}>
          {results.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '350px', overflowY: 'auto' }}>
              {results.map((item, idx) => {
                if (item.type === 'header') {
                  return (
                    <li key={idx} style={{ 
                      padding: '8px 15px', 
                      backgroundColor: '#f5f5f5', 
                      color: '#666', 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold', 
                      textTransform: 'uppercase' 
                    }}>
                      {item.label}
                    </li>
                  )
                }

                if (item.type === 'user') {
                  return (
                    <li 
                      key={idx} 
                      onClick={() => handleSelect(item)}
                      style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#fdfbc0'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ pointerEvents: 'none' }}>
                        <span style={{ fontSize: '1.1rem', marginRight: '10px' }}>👷</span>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{item.data.nombre_completo}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#888', pointerEvents: 'none', marginTop: '3px', marginLeft: '35px' }}>
                        {item.data.rol === 'admin' ? 'Administrador' : 'Colaborador'}
                      </div>
                    </li>
                  )
                }

                if (item.type === 'product') {
                  return (
                    <li 
                      key={idx} 
                      onClick={() => handleSelect(item)}
                      style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#fdfbc0'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ pointerEvents: 'none' }}>
                        <span style={{ fontSize: '1.1rem', marginRight: '10px' }}>🛍️</span>
                        <span style={{ color: '#333' }}>{item.data.name}</span>
                      </div>
                    </li>
                  )
                }

                if (item.type === 'order') {
                  return (
                    <li 
                      key={idx} 
                      onClick={() => handleSelect(item)}
                      style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#fdfbc0'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ pointerEvents: 'none' }}>
                        <span style={{ fontSize: '1.1rem', marginRight: '10px' }}>📄</span>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>#{item.data.id.toString().slice(0, 8)}</span>
                        <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#666' }}>(${Number(item.data.total).toFixed(2)})</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#888', pointerEvents: 'none', marginTop: '3px', marginLeft: '35px' }}>
                        Cliente: {item.data.nombre_cliente || 'Invitado'} · {new Date(item.data.created_at).toLocaleDateString()}
                      </div>
                    </li>
                  )
                }

                return null;
              })}
            </ul>
          ) : (
             <div style={{ padding: '15px', textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
               No se encontraron resultados
             </div>
          )}
        </div>
      )}
    </div>
  );
}
