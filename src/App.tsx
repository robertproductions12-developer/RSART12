/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase.ts';
import { ref, onValue, push, set, remove, runTransaction } from 'firebase/database';
import { 
  ShoppingBag, 
  Settings, 
  Bell, 
  X, 
  Plus, 
  Trash2, 
  Check, 
  FileText, 
  Instagram, 
  MessageCircle,
  Phone,
  Clock,
  Zap,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import html2pdf from 'html2pdf.js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Product {
  key: string;
  nombre: string;
  precio: number; // in USD
  stock: number;
  img1: string;
  seccionId?: string;
}

interface Section {
  key: string;
  nombre: string;
}

interface Order {
  key: string;
  items: any[];
  totalUsd: number;
  totalBs: number;
  tasa: number;
  metodo: string;
  tel: string;
  ref: string;
  obs: string;
  fecha: string;
  status: 'rojo' | 'amarillo' | 'verde';
}

interface Config {
  pagos: {
    movil: string;
    banco: string;
  };
  exito: {
    mensaje: string;
    imagen: string;
  };
  tasa: number;
  whatsapp: string;
  instagram: string;
}

export default function App() {
  const [carrito, setCarrito] = useState<any[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [secciones, setSecciones] = useState<Section[]>([]);
  const [pedidos, setPedidos] = useState<Order[]>([]);
  const [config, setConfig] = useState<Config>({
    pagos: { movil: '', banco: '' },
    exito: { mensaje: '¡GRACIAS POR ELEGIR RS ART!', imagen: '' },
    tasa: 1,
    whatsapp: '',
    instagram: ''
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const sirenAudio = useRef<HTMLAudioElement | null>(null);

  // Firebase connection status
  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    onValue(connectedRef, (snap) => {
      setIsOnline(!!snap.val());
    });

    const configRef = ref(db, 'configuracion');
    onValue(configRef, (snap) => {
      const data = snap.val();
      if (data) {
        setConfig(prev => ({
          ...prev,
          ...data,
          pagos: data.pagos || prev.pagos,
          exito: data.exito || prev.exito,
          tasa: data.tasa || prev.tasa,
          whatsapp: data.whatsapp || '',
          instagram: data.instagram || ''
        }));
      }
    });

    const prodRef = ref(db, 'productos');
    onValue(prodRef, (snap) => {
      const items: Product[] = [];
      snap.forEach((child) => {
        items.push({ ...child.val(), key: child.key });
      });
      setProductos(items);
    });

    const secRef = ref(db, 'secciones');
    onValue(secRef, (snap) => {
      const items: Section[] = [];
      snap.forEach((child) => {
        items.push({ ...child.val(), key: child.key });
      });
      setSecciones(items);
    });

    const pedRef = ref(db, 'pedidos');
    onValue(pedRef, (snap) => {
      const items: Order[] = [];
      snap.forEach((child) => {
        items.push({ ...child.val(), key: child.key });
      });
      setPedidos(items);
    });
  }, []);

  // Alarm Monitor for Admin
  useEffect(() => {
    if (!isAdmin) return;

    const alarmRef = ref(db, 'alarma_evento');
    const unsubscribe = onValue(alarmRef, (snap) => {
      const data = snap.val();
      if (!data) return;

      const ahora = Date.now();
      if (ahora - data.timestamp > 10000) return;

      sirenAudio.current?.play();
      Swal.fire({
        title: data.tipo,
        text: data.info,
        icon: "warning",
        background: '#0F091A',
        color: '#fff',
        confirmButtonColor: '#E91E63'
      }).then(() => {
        sirenAudio.current?.pause();
        if (sirenAudio.current) sirenAudio.current.currentTime = 0;
      });
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const toggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      return;
    }
    Swal.fire({
      title: 'Acceso Admin',
      input: 'password',
      inputPlaceholder: 'Ingrese clave',
      background: '#0F091A',
      color: '#fff',
      confirmButtonColor: '#C6FF00'
    }).then((result) => {
      if (result.value === '2025') {
        setIsAdmin(true);
      } else if (result.value) {
        Swal.fire('Error', 'Clave incorrecta', 'error');
      }
    });
  };

  const alCarrito = (p: Product) => {
    const existe = carrito.find(x => x.key === p.key);
    const stockVal = p.stock || 0;

    if (existe) {
      if (existe.cantidad < stockVal) {
        setCarrito(carrito.map(x => x.key === p.key ? { ...x, cantidad: x.cantidad + 1 } : x));
      } else {
        Swal.fire("Límite de Stock", "No hay más unidades disponibles", "warning");
        return;
      }
    } else {
      setCarrito([...carrito, { ...p, cantidad: 1 }]);
    }

    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500,
      background: '#0F091A',
      color: '#fff'
    });
    Toast.fire({ icon: 'success', title: 'Agregado al estudio' });
  };

  const cambiarCant = (key: string, delta: number) => {
    const item = carrito.find(x => x.key === key);
    if (!item) return;

    if (delta > 0) {
      const prod = productos.find(x => x.key === key);
      if (prod && item.cantidad >= prod.stock) {
        Swal.fire("Límite de Stock", "No hay más unidades disponibles", "warning");
        return;
      }
    }

    const nuevaCant = item.cantidad + delta;
    if (nuevaCant < 1) {
      setCarrito(carrito.filter(x => x.key !== key));
    } else {
      setCarrito(carrito.map(x => x.key === key ? { ...x, cantidad: nuevaCant } : x));
    }
  };

  const tocarTimbre = () => {
    set(ref(db, 'alarma_evento'), {
      id: Math.random(),
      tipo: "TIMBRE",
      info: "Atención cliente",
      timestamp: Date.now()
    });
    Swal.fire({
      title: "NOTIFICANDO",
      icon: "success",
      timer: 1000,
      showConfirmButton: false,
      background: '#0F091A',
      color: '#fff'
    });
  };

  const enviarWhatsAppExito = (pedido: any) => {
    const phone = config.whatsapp || "584120000000"; // Dummy or real
    const message = `*FACTURA RS ART*\n` +
      `Fecha: ${pedido.fecha}\n` +
      `--------------------------\n` +
      pedido.items.map((i: any) => `- ${i.nombre} x${i.cantidad} ($${i.precio})`).join('\n') +
      `\n--------------------------\n` +
      `*Total USD:* $${pedido.totalUsd}\n` +
      `*Total Bs:* Bs. ${pedido.totalBs.toLocaleString('de-DE')}\n` +
      `*Tasa:* ${pedido.tasa}\n` +
      `*Método:* ${pedido.metodo}\n` +
      `*Referencia:* ${pedido.ref}\n` +
      `--------------------------\n` +
      `Gracias por su compra.`;

    const url = `https://wa.me/${phone.replace(/\+/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const finalizarCompra = async (details: any) => {
    const totalUsd = carrito.reduce((s, p) => s + (p.precio * p.cantidad), 0);
    const totalBs = totalUsd * config.tasa;

    const pedido: Omit<Order, 'key'> = {
      items: carrito,
      totalUsd,
      totalBs,
      tasa: config.tasa,
      metodo: details.metodo,
      tel: details.tel,
      ref: details.ref,
      obs: details.obs,
      fecha: new Date().toLocaleString(),
      status: details.status
    };

    try {
      // Create order
      const newPedRef = push(ref(db, 'pedidos'));
      await set(newPedRef, pedido);

      // Distount stock
      for (const item of carrito) {
        const prodStockRef = ref(db, `productos/${item.key}/stock`);
        await runTransaction(prodStockRef, (current) => {
          return (current || 0) - item.cantidad;
        });
      }

      // Signal alarm
      set(ref(db, 'alarma_evento'), {
        id: Math.random(),
        tipo: "COMPRA",
        info: `Total: $${totalUsd} / Bs. ${totalBs.toLocaleString('de-DE')}`,
        timestamp: Date.now()
      });

      // Clear cart
      const finalItems = [...carrito];
      setCarrito([]);
      setShowCart(false);

      // WhatsApp Invoice
      Swal.fire({
        title: config.exito.mensaje,
        imageUrl: config.exito.imagen || 'https://via.placeholder.com/400x300?text=RS+ART',
        imageWidth: 300,
        background: '#0F091A',
        color: '#fff',
        confirmButtonText: 'RECIBO WHATSAPP',
        confirmButtonColor: '#25D366'
      }).then(() => {
        enviarWhatsAppExito({ ...pedido, items: finalItems });
      });

    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudo procesar el pedido", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#0F091A] text-white font-sans selection:bg-[#C6FF00] selection:text-black">
      <audio ref={sirenAudio} loop src="https://www.soundjay.com/buttons/sounds/beep-01a.mp3" />

      {/* Navbar */}
      <nav className="sticky top-0 z-[60] bg-[#0F091A]/90 backdrop-blur-xl border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 bg-[#C6FF00] rounded-xl flex items-center justify-center text-black font-black text-xl shadow-lg shadow-lime-500/20">RS</div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tighter leading-none">ART <span className="text-[#C6FF00] text-[10px]">STUDIO</span></h1>
          </div>
        </motion.div>

        <div className="flex gap-3 items-center">
          <button 
            onClick={() => setShowCart(true)}
            className="relative p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all transition-transform active:scale-95"
          >
            <ShoppingBag className="w-6 h-6 text-[#C6FF00]" />
            {carrito.length > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-[#E91E63] text-white text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0F091A] animate-bounce"
              >
                {carrito.length}
              </motion.span>
            )}
          </button>
          <button 
            onClick={toggleAdmin}
            className={cn(
              "w-10 h-10 md:w-12 md:h-12 rounded-2xl border border-white/10 flex items-center justify-center transition-all",
              isAdmin ? "bg-[#C6FF00] text-black" : "text-gray-500 hover:text-white"
            )}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 md:px-8 py-8 space-y-12">
        {/* Timbre Section */}
        <section>
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={tocarTimbre}
            className="group relative overflow-hidden bg-gradient-to-br from-[#E91E63] to-[#2D1B4E] border-[3px] border-[#C6FF00] rounded-[30px] md:rounded-[40px] p-8 md:p-12 flex flex-col items-center justify-center cursor-pointer shadow-2xl shadow-lime-500/10"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Bell className="w-16 h-16 md:w-20 md:h-20 mb-4 animate-bounce text-[#C6FF00]" />
            <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter">TOCAR TIMBRE</h2>
            <p className="text-white/60 text-[10px] md:text-sm mt-2 font-bold uppercase tracking-[0.3em]">Notificación Prioritaria</p>
          </motion.div>
        </section>

        {/* Hero Slider */}
        <section>
          <Swiper
            modules={[Pagination, Autoplay]}
            pagination={{ clickable: true }}
            autoplay={{ delay: 4000 }}
            loop={true}
            className="w-full h-64 md:h-[450px] rounded-[30px] md:rounded-[45px] overflow-hidden shadow-2xl"
          >
            <SwiperSlide><img src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=2671&auto=format&fit=crop" className="w-full h-full object-cover" /></SwiperSlide>
            <SwiperSlide><img src="https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2670&auto=format&fit=crop" className="w-full h-full object-cover" /></SwiperSlide>
            <SwiperSlide><img src="https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=2745&auto=format&fit=crop" className="w-full h-full object-cover" /></SwiperSlide>
          </Swiper>
        </section>

        {/* Catalog */}
        <section className="space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter">CATÁLOGO <span className="text-[#E91E63]">RS</span></h2>
              <p className="text-[#C6FF00] font-bold text-xs">Tasa del día: 1 $ = Bs. {config.tasa}</p>
            </div>
            <div className={cn(
              "text-[10px] font-black px-4 py-2 rounded-full border flex items-center gap-2",
              isOnline ? "bg-lime-500/10 text-lime-400 border-lime-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
            )}>
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-lime-400 animate-pulse" : "bg-red-400")} />
              {isOnline ? "SISTEMA ONLINE" : "OFFLINE"}
            </div>
          </div>

          {/* Group products by sections */}
          <div className="space-y-16">
            {/* Sections Headers + Products */}
            {secciones.length > 0 ? secciones.map(section => {
              const sectionProds = productos.filter(p => p.seccionId === section.key);
              if (sectionProds.length === 0) return null;
              return (
                <div key={section.key} className="space-y-8">
                  <h3 className="text-2xl md:text-3xl font-black italic border-l-4 border-[#C6FF00] pl-4 uppercase tracking-tighter text-white/90">
                    {section.nombre}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sectionProds.map(p => (
                      <ProductCard key={p.key} product={p} toggleCarrito={alCarrito} />
                    ))}
                  </div>
                </div>
              );
            }) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {productos.map(p => (
                  <ProductCard key={p.key} product={p} toggleCarrito={alCarrito} />
                ))}
              </div>
            )}

            {/* Products without sections if exists */}
            {secciones.length > 0 && productos.some(p => !p.seccionId) && (
              <div className="space-y-8">
                <h3 className="text-2xl md:text-3xl font-black italic border-l-4 border-white/20 pl-4 uppercase tracking-tighter text-white/90">
                  SIN CATEGORÍA
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {productos.filter(p => !p.seccionId).map(p => (
                    <ProductCard key={p.key} product={p} toggleCarrito={alCarrito} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black/40 border-t border-white/5 py-12 px-6">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
             <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#C6FF00] rounded-lg flex items-center justify-center text-black font-black text-sm">RS</div>
              <h2 className="text-xl font-black italic tracking-tighter">RS ART <span className="text-[#C6FF00]">STUDIO</span></h2>
            </div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">© 2026 Todos los derechos reservados</p>
          </div>

          <div className="flex gap-4">
            <a 
              href={config.instagram || "https://instagram.com"} 
              target="_blank" 
              className="p-4 bg-white/5 rounded-2xl hover:bg-[#E91E63] transition-all group"
            >
              <Instagram className="w-6 h-6 group-hover:scale-110 transition-transform" />
            </a>
            <a 
              href={`https://wa.me/${(config.whatsapp || "58412000000").replace(/\+/g, '')}`} 
              target="_blank" 
              className="p-4 bg-white/5 rounded-2xl hover:bg-[#25D366] transition-all group"
            >
              <Phone className="w-6 h-6 group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>
      </footer>

      {/* Cart Modal */}
      <AnimatePresence>
        {showCart && (
          <CartModal 
            carrito={carrito} 
            config={config} 
            onClose={() => setShowCart(false)} 
            cambiarCant={cambiarCant}
            onFinalizar={finalizarCompra}
          />
        )}
      </AnimatePresence>

      {/* Admin Panel */}
      <AnimatePresence>
        {isAdmin && (
          <AdminPanel 
            productos={productos} 
            secciones={secciones}
            pedidos={pedidos}
            config={config}
            onClose={() => setIsAdmin(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductCard({ product, toggleCarrito }: { product: Product, toggleCarrito: (p: Product) => void, key?: any }) {
  const stockVal = product.stock || 0;
  const isAgotado = stockVal <= 0;

  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[30px] overflow-hidden transition-all hover:border-[#C6FF00]/50"
    >
      <div className="h-56 relative overflow-hidden group">
        <img 
          src={product.img1} 
          alt={product.nombre}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        />
        {isAgotado && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <span className="font-black text-[#E91E63] italic text-2xl tracking-tighter uppercase">AGOTADO</span>
          </div>
        )}
      </div>
      <div className="p-6 md:p-8 space-y-4">
        <div>
          <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter truncate">{product.nombre}</h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase">STOCK: <span className={cn(stockVal < 5 ? "text-red-500" : "text-white")}>{stockVal}</span></p>
        </div>
        <div className="flex justify-between items-center gap-4">
          <div className="space-y-0.5">
            <p className="text-2xl md:text-3xl font-black text-[#C6FF00] tracking-tighter">${product.precio}</p>
          </div>
          <button 
            disabled={isAgotado}
            onClick={() => toggleCarrito(product)}
            className={cn(
              "px-6 py-3 rounded-2xl text-[10px] font-black italic uppercase tracking-widest transition-all active:scale-95",
              isAgotado ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-[#E91E63] hover:brightness-110 shadow-lg shadow-magenta-500/20"
            )}
          >
            {isAgotado ? "SIN STOCK" : "Añadir"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CartModal({ carrito, config, onClose, cambiarCant, onFinalizar }: any) {
  const totalUsd = carrito.reduce((s: any, p: any) => s + (p.precio * p.cantidad), 0);
  const totalBs = totalUsd * config.tasa;

  const [metodo, setMetodo] = useState('');
  const [tel, setTel] = useState('');
  const [refNum, setRefNum] = useState('');
  const [status, setStatus] = useState<'rojo' | 'amarillo' | 'verde'>('rojo');
  const [obs, setObs] = useState('');

  const handleConfirm = () => {
    if (!metodo || !tel || !refNum) {
      Swal.fire("Incompleto", "Faltan datos de pago", "error");
      return;
    }
    onFinalizar({ metodo, tel, ref: refNum, status, obs });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-[#0F091A] border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[35px] p-6 md:p-10 hide-scrollbar"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/5 rounded-full hover:bg-white/10">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase mb-8">Confirmar Compra</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {carrito.map((p: any) => (
                <div key={p.key} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex-1">
                    <h4 className="font-black text-xs uppercase truncate">{p.nombre}</h4>
                    <p className="text-[#C6FF00] font-bold text-xs">${p.precio} <span className="text-gray-500">/</span> Bs. {(p.precio * config.tasa).toLocaleString('de-DE')}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => cambiarCant(p.key, -1)} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-xl hover:bg-[#E91E63] transition">-</button>
                    <span className="font-black text-xl w-4 text-center">{p.cantidad}</span>
                    <button onClick={() => cambiarCant(p.key, 1)} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-xl hover:bg-[#C6FF00] hover:text-black transition">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
               <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold uppercase">Subtotal USD</span>
                <span className="text-xl font-black">${totalUsd.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[#C6FF00]">
                <span className="text-xs font-bold uppercase">Total Bolívares (x{config.tasa})</span>
                <span className="text-3xl md:text-4xl font-black tracking-tighter">Bs. {totalBs.toLocaleString('de-DE')}</span>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Información de Pago</label>
              <select 
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-[#C6FF00] transition"
              >
                <option value="" className="bg-[#0F091A]">Seleccionar Método</option>
                <option value="Pago Móvil" className="bg-[#0F091A]">Pago Móvil</option>
                <option value="Transferencia" className="bg-[#0F091A]">Transferencia</option>
              </select>
              
              {metodo && (
                <div className="p-4 bg-[#C6FF00]/10 rounded-2xl border border-[#C6FF00]/20 text-[#C6FF00] font-bold text-[11px] italic">
                  {metodo === 'Pago Móvil' ? (
                    <>TRANSFERIR A:<br/>{config.pagos.movil}</>
                  ) : (
                    <>BANCO:<br/>{config.pagos.banco}</>
                  )}
                </div>
              )}

              <input 
                type="text" 
                placeholder="Celular Origen" 
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-[#C6FF00] transition"
              />
              <input 
                type="text" 
                placeholder="Referencia" 
                value={refNum}
                onChange={(e) => setRefNum(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-[#C6FF00] transition"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Prioridad de Entrega</label>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => setStatus('rojo')}
                  className={cn(
                    "p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all",
                    status === 'rojo' ? "bg-red-600/20 border-red-500 text-red-500" : "bg-white/5 border-white/10 text-gray-500"
                  )}
                >
                  <Zap className="w-6 h-6" />
                  <span className="text-[8px] font-black uppercase">Urgente</span>
                </button>
                <button 
                  onClick={() => setStatus('amarillo')}
                  className={cn(
                    "p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all",
                    status === 'amarillo' ? "bg-orange-600/20 border-orange-500 text-orange-500" : "bg-white/5 border-white/10 text-gray-500"
                  )}
                >
                  <Clock className="w-6 h-6" />
                  <span className="text-[8px] font-black uppercase">Mediano</span>
                </button>
                <button 
                  onClick={() => setStatus('verde')}
                  className={cn(
                    "p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all",
                    status === 'verde' ? "bg-green-600/20 border-green-500 text-green-500" : "bg-white/5 border-white/10 text-gray-500"
                  )}
                >
                  <Calendar className="w-6 h-6" />
                  <span className="text-[8px] font-black uppercase">Largo</span>
                </button>
              </div>
            </div>

            <textarea 
              placeholder="Detalles extra del pedido..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-[#C6FF00] transition h-24 resize-none"
            />

            <button 
              onClick={handleConfirm}
              className="w-full bg-[#E91E63] text-white font-black py-5 rounded-2xl italic uppercase tracking-widest shadow-xl shadow-magenta-500/20 hover:brightness-110 transition active:scale-95"
            >
              CONFIRMAR PEDIDO
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AdminPanel({ productos, secciones, pedidos, config, onClose }: any) {
  const [activeTab, setActiveTab] = useState<'stock' | 'pedidos' | 'config' | 'secciones'>('stock');

  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [img, setImg] = useState('');
  const [seccionId, setSeccionId] = useState('');

  const [secName, setSecName] = useState('');

  const handleImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImg(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addProducto = () => {
    if (!nombre || !precio || !stock || !img) {
      Swal.fire("Error", "Faltan campos", "error");
      return;
    }
    push(ref(db, 'productos'), { 
      nombre, 
      precio: parseFloat(precio), 
      stock: parseInt(stock), 
      img1: img,
      seccionId: seccionId || null
    });
    setNombre(''); setPrecio(''); setStock(''); setImg('');
    Swal.fire("Éxito", "Producto agregado", "success");
  };

  const addSeccion = () => {
    if (!secName) return;
    push(ref(db, 'secciones'), { nombre: secName });
    setSecName('');
    Swal.fire("Éxito", "Sección agregada", "success");
  };

  const updateConfig = (key: string, value: any) => {
    set(ref(db, `configuracion/${key}`), value);
  };

  const removePed = (key: string) => {
    if (confirm("¿Completar pedido?")) remove(ref(db, `pedidos/${key}`));
  };

  const downloadReport = () => {
    const element = document.getElementById('report-area');
    html2pdf().set({ margin: 1, filename: 'pedidos_rs_art.pdf' }).from(element).save();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-[#0F091A]" 
      />
      
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-[#0F091A] border-l border-white/10 w-full h-full md:rounded-[45px] overflow-hidden flex flex-col md:flex-row"
      >
        {/* Sidebar */}
        <div className="w-full md:w-80 bg-white/5 border-r border-white/5 p-8 flex flex-col gap-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black italic tracking-tighter text-[#C6FF00]">SISTEMA</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Admin Control</p>
            </div>
            <button onClick={onClose} className="p-3 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { id: 'stock', label: 'Inventario', icon: ShoppingBag },
              { id: 'pedidos', label: 'Pedidos', icon: FileText },
              { id: 'secciones', label: 'Categorías', icon: Plus },
              { id: 'config', label: 'Ajustes', icon: Settings }
            ].map((tab: any) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-4 px-6 py-4 rounded-2xl font-bold uppercase text-xs transition-all",
                  activeTab === tab.id ? "bg-[#C6FF00] text-black" : "bg-white/5 text-gray-500 hover:bg-white/10"
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
          {activeTab === 'stock' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
              <div className="space-y-8">
                <h3 className="text-4xl font-black italic tracking-tighter uppercase">Gestionar <span className="text-[#E91E63]">Stock</span></h3>
                <div className="space-y-4">
                  <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del Producto" className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-[#C6FF00]" />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Precio (USD)" className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-[#C6FF00]" />
                    <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="Cantidad" className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-[#C6FF00]" />
                  </div>
                  <select 
                    value={seccionId} 
                    onChange={e => setSeccionId(e.target.value)}
                    className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-[#C6FF00]"
                  >
                    <option value="" className="bg-[#0F091A]">Seleccionar Sección (Opcional)</option>
                    {secciones.map((s: any) => (
                      <option key={s.key} value={s.key} className="bg-[#0F091A]">{s.nombre}</option>
                    ))}
                  </select>
                  <label className="block p-8 border-2 border-dashed border-white/10 rounded-2xl text-center cursor-pointer hover:border-[#C6FF00] transition">
                    <input type="file" onChange={handleImg} hidden />
                    {img ? <img src={img} className="h-32 mx-auto rounded-xl" /> : <div className="text-gray-500 font-bold uppercase text-xs">Cargar Imagen</div>}
                  </label>
                  <button onClick={addProducto} className="w-full bg-[#C6FF00] text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Añadir al Stock</button>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-black italic text-gray-500 uppercase tracking-widest">Vista Previa Stock</h3>
                <div className="space-y-3">
                  {productos.map((p: any) => (
                    <div key={p.key} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <img src={p.img1} className="w-12 h-12 rounded-xl object-cover" />
                      <div className="flex-1">
                        <h4 className="font-bold text-xs uppercase truncate">{p.nombre}</h4>
                        <p className="text-[10px] text-[#C6FF00]">${p.precio} <span className="text-gray-600">|</span> Stock: {p.stock}</p>
                      </div>
                      <button onClick={() => remove(ref(db, `productos/${p.key}`))} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'secciones' && (
             <div className="max-w-2xl space-y-12">
               <div className="space-y-8">
                 <h3 className="text-4xl font-black italic tracking-tighter uppercase">Gestionar <span className="text-[#C6FF00]">Secciones</span></h3>
                 <div className="flex gap-4">
                    <input value={secName} onChange={e => setSecName(e.target.value)} placeholder="Nueva Sección" className="flex-1 bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-[#C6FF00]" />
                    <button onClick={addSeccion} className="px-8 bg-[#C6FF00] text-black font-black rounded-2xl uppercase text-xs">Agregar</button>
                 </div>
               </div>
               <div className="space-y-4">
                  {secciones.map((s: any) => (
                    <div key={s.key} className="flex items-center justify-between bg-white/5 p-6 rounded-2xl border border-white/5">
                      <span className="font-black italic uppercase tracking-tighter text-xl">{s.nombre}</span>
                      <button onClick={() => remove(ref(db, `secciones/${s.key}`))} className="p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition">
                        <Trash2 className="w-6 h-6" />
                      </button>
                    </div>
                  ))}
               </div>
             </div>
          )}

          {activeTab === 'pedidos' && (
            <div className="space-y-10">
              <div className="flex justify-between items-end">
                <h3 className="text-4xl font-black italic tracking-tighter uppercase">Lista de <span className="text-orange-500">Pedidos</span> ({pedidos.length})</h3>
                <button onClick={downloadReport} className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:brightness-110 transition">
                  <FileText className="w-4 h-4" /> PDF Report
                </button>
              </div>

              <div id="report-area" className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
                {pedidos.sort((a: any, b: any) => {
                  const map: any = { rojo: 1, amarillo: 2, verde: 3 };
                  return map[a.status] - map[b.status];
                }).map((ped: any) => (
                  <div 
                    key={ped.key} 
                    className={cn(
                      "p-6 rounded-[25px] border-l-[6px] space-y-4",
                      ped.status === 'rojo' ? "bg-red-500/5 border-red-500 shadow-lg shadow-red-500/5" : 
                      ped.status === 'amarillo' ? "bg-orange-500/5 border-orange-500" : "bg-green-500/5 border-green-500"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-black uppercase text-white/40 mb-1">
                          <Clock className="w-3 h-3" /> {ped.fecha}
                        </div>
                        <h4 className="text-2xl font-black italic text-[#C6FF00]">USD ${ped.totalUsd} / Bs. {ped.totalBs.toLocaleString('de-DE')}</h4>
                      </div>
                      <button onClick={() => removePed(ped.key)} className="w-10 h-10 bg-green-500 text-black rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition">
                        <Check className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="text-[11px] font-bold space-y-2">
                       <p className="text-white/30 uppercase tracking-widest">PRODUCTOS</p>
                       <p className="text-white/90">{ped.items.map((i: any) => `${i.nombre} (x${i.cantidad})`).join(', ')}</p>
                       <div className="pt-2 grid grid-cols-2 gap-4 border-t border-white/5">
                          <div>
                            <p className="text-white/30 uppercase tracking-widest">PAGO</p>
                            <p>{ped.metodo} - {ped.tel}</p>
                            <p className="text-[#C6FF00]">Ref: {ped.ref}</p>
                          </div>
                          <div>
                            <p className="text-white/30 uppercase tracking-widest">OBSERVACIÓN</p>
                            <p className="italic text-gray-500">{ped.obs || 'Sin notas'}</p>
                          </div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="max-w-xl space-y-8 pb-20">
              <h3 className="text-4xl font-black italic tracking-tighter uppercase">Ajustes <span className="text-[#E91E63]">Globales</span></h3>
              
              <div className="space-y-6">
                {/* Tasa Ajuste */}
                <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                  <h4 className="font-black italic uppercase tracking-tighter text-[#C6FF00] flex items-center gap-2">
                    <Zap className="w-5 h-5" /> Tasa de Cambio
                  </h4>
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Valor actual: 1 $ = Bs. {config.tasa}</p>
                    <input 
                      type="number" 
                      value={config.tasa} 
                      onChange={e => updateConfig('tasa', parseFloat(e.target.value))} 
                      className="w-full bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#C6FF00]" 
                    />
                  </div>
                </div>

                <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                  <h4 className="font-black italic uppercase tracking-tighter text-[#C6FF00]">Cuentas de Banco</h4>
                  <textarea value={config.pagos.movil} onChange={e => updateConfig('pagos', { ...config.pagos, movil: e.target.value })} placeholder="Pago Móvil" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 h-24 text-xs" />
                  <textarea value={config.pagos.banco} onChange={e => updateConfig('pagos', { ...config.pagos, banco: e.target.value })} placeholder="Transferencia" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 h-24 text-xs" />
                </div>

                <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                  <h4 className="font-black italic uppercase tracking-tighter text-[#C6FF00]">Redes Sociales</h4>
                  <input value={config.instagram} onChange={e => updateConfig('instagram', e.target.value)} placeholder="URL Instagram" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 text-xs" />
                  <input value={config.whatsapp} onChange={e => updateConfig('whatsapp', e.target.value)} placeholder="Número WhatsApp (ej: 584120000000)" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 text-xs" />
                </div>
                
                <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                  <h4 className="font-black italic uppercase tracking-tighter text-[#C6FF00]">Mensaje de Éxito</h4>
                  <input value={config.exito.mensaje} onChange={e => updateConfig('exito', { ...config.exito, mensaje: e.target.value })} className="w-full bg-black/40 p-4 rounded-xl border border-white/10 text-xs" />
                  <label className="block p-4 border border-dashed border-white/10 rounded-xl text-center cursor-pointer text-[10px] text-gray-500 uppercase font-bold">
                    Cambiar Imagen Éxito
                    <input type="file" hidden onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const r = new FileReader();
                        r.onloadend = () => updateConfig('exito', { ...config.exito, imagen: r.result });
                        r.readAsDataURL(f);
                      }
                    }} />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
