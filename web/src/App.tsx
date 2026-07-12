import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Turnstile } from '@marsidev/react-turnstile'
import { AreaChart, Area, BarChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownUp, BarChart3, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, HelpCircle, LayoutDashboard, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Pencil, PieChart as PieIcon, Plus, Search, Settings, Sun, Tags, Trash2, WalletCards, X } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { Asset, Cadence, Category, defaultCategories, Entry, FlowKind } from './types'

type Page = 'dashboard' | 'transactions' | 'recurring' | 'assets' | 'settings'
const trMoney = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })
const trMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' })
const today = new Date().toISOString().slice(0, 10)
const nav = [
  { id: 'dashboard' as Page, label: 'Özet', icon: LayoutDashboard }, { id: 'transactions' as Page, label: 'Hareketler', icon: ArrowDownUp },
  { id: 'recurring' as Page, label: 'Düzenli', icon: CalendarDays }, { id: 'assets' as Page, label: 'Varlıklar', icon: WalletCards },
  { id: 'settings' as Page, label: 'Ayarlar', icon: Settings }
]
const guideSteps = [
  { title: 'Yeni hareket ekleme', text: 'Gelir veya gider kaydı eklemek için sağ üstteki “Yeni hareket” düğmesini kullanın.', spot: 'top-action' },
  { title: 'Hareketleri bulma', text: 'Hareketler sayfasında arama, tür, kategori ve sıralama filtreleriyle kayıtları hızlıca daraltabilirsiniz.', spot: 'filters' },
  { title: 'Kategorileri yönetme', text: 'Hareketler sayfasındaki etiket simgesiyle kategorileri açıp yeni kategori ve renk ekleyebilirsiniz.', spot: 'category-action' },
  { title: 'Grafikleri düzenleme', text: 'Özet ekranındaki grafikler sağ üst menüden düzenlenir veya silinir. Basılı tutup sürükleyerek yerlerini değiştirebilirsiniz.', spot: 'charts' },
  { title: 'Sayfalar arasında gezinme', text: 'PC’de soldaki menü, telefonda alttaki sekmeler ile Özet, Hareketler, Düzenli ve Ayarlar arasında geçiş yapılır.', spot: 'navigation' },
  { title: 'Ayarlar', text: 'Tema, kedi bildirimi, kategori yönetimi ve bu rehbere tekrar ulaşma seçenekleri Ayarlar sayfasındadır.', spot: 'settings' }
]
type ChartKind = 'bar' | 'pie' | 'area'
type ChartMetric = 'both' | 'income' | 'expense' | 'categoryExpense'
type ChartRange = 'month' | 'week' | 'all'
type ChartWidget = { id:string; title:string; chart:ChartKind; metric:ChartMetric; range:ChartRange }
const defaultWidgets: ChartWidget[] = [
  { id:'flow', title:'Gelir ve gider akışı', chart:'bar', metric:'both', range:'all' },
  { id:'expense-pie', title:'Gider dağılımı', chart:'pie', metric:'categoryExpense', range:'month' }
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, value) => setSession(value))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!authReady) return <div className="splash"><div className="brand-mark">₺</div><b>Harcamac</b></div>
  if (!session) return <Auth />
  return <FinanceApp session={session} />
}

function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [busy, setBusy] = useState(false)
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()

  async function socialLogin() {
    setBusy(true); setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) { setMessage(error.message); setBusy(false) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    if (!isSupabaseConfigured) { setMessage('Supabase bağlantısı henüz yapılandırılmadı. .env dosyasını kontrol edin.'); setBusy(false); return }
    if (mode === 'signup' && password !== passwordAgain) { setMessage('Şifreler birbiriyle eşleşmiyor.'); setBusy(false); return }
    if (turnstileSiteKey && !captchaToken) { setMessage('Lütfen robot olmadığınızı doğrulayın.'); setBusy(false); return }
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captchaToken || undefined } })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: redirectTo, captchaToken: captchaToken || undefined } })
    setMessage(result.error?.message || (mode === 'signup' ? 'Doğrulama bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu kontrol edin.' : ''))
    setBusy(false)
  }
  return <main className="auth-shell">
    <section className="auth-story"><div className="auth-brand"><span className="brand-mark">₺</span> Harcamac</div><div><h1>Paranızın nereye gittiğini bilin.</h1><p>Gelirlerinizi, harcamalarınızı ve varlıklarınızı sade bir ekranda takip edin.</p></div><small>Kişisel finans, daha sakin.</small></section>
    <section className="auth-panel"><form className="auth-form" onSubmit={submit}>
      <div><h2>{mode === 'login' ? 'Tekrar hoş geldiniz' : 'Hesabınızı oluşturun'}</h2><p>{mode === 'login' ? 'Devam etmek için giriş yapın.' : 'Finans takibinize birkaç saniyede başlayın.'}</p></div>
      {mode === 'signup' && <label>Ad soyad<input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>}
      <label>E-posta<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <label>Şifre<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
      {mode === 'signup' && <label>Şifreyi doğrula<input required minLength={8} type="password" value={passwordAgain} onChange={e => setPasswordAgain(e.target.value)} autoComplete="new-password" /></label>}
      {turnstileSiteKey && <div className="turnstile-wrap"><Turnstile siteKey={turnstileSiteKey} options={{ language: 'tr', theme: 'auto' }} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken('')} onError={() => setCaptchaToken('')} /></div>}
      {message && <div className="form-message">{message}</div>}
      <button className="primary wide" disabled={busy}>{busy ? 'Bekleyin…' : mode === 'login' ? 'Giriş yap' : 'Üye ol'}</button>
      <div className="auth-divider"><span>veya</span></div>
      <div className="social-buttons"><button type="button" onClick={socialLogin} disabled={busy}><span className="google-mark">G</span>Google ile devam et</button></div>
      <button type="button" className="text-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setPasswordAgain(''); setCaptchaToken(''); setMessage('') }}>{mode === 'login' ? 'Hesabınız yok mu? Üye olun' : 'Zaten hesabınız var mı? Giriş yapın'}</button>
    </form></section>
  </main>
}

function FinanceApp({ session }: { session: Session }) {
  const [page, setPage] = useState<Page>('dashboard')
  const [entries, setEntries] = useState<Entry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [entryOpen, setEntryOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('sidebarOpen') !== 'false')
  const [catAlerts, setCatAlerts] = useState(() => localStorage.getItem('catAlerts') !== 'false')
  const [toast, setToast] = useState<{kind:FlowKind;text:string}|null>(null)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light')
  const userId = session.user.id

  async function loadData() {
    setLoading(true)
    const [e, c, a] = await Promise.all([
      supabase.from('entries').select('*, categories(name)').order('entry_date', { ascending: false }),
      supabase.from('categories').select('*').order('name'), supabase.from('assets').select('*').order('created_at', { ascending: false })
    ])
    setEntries((e.data || []).map((x: any) => ({ ...x, category_name: x.categories?.name || 'Diğer' })))
    const loadedCategories = (c.data || []) as Category[]
    setCategories(loadedCategories); setAssets((a.data || []) as Asset[]); setLoading(false)
    if (!loadedCategories.length && !c.error) setSetupOpen(true)
  }
  useEffect(() => { loadData() }, [userId])
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('sidebarOpen', String(sidebarOpen)) }, [sidebarOpen])
  useEffect(() => { localStorage.setItem('catAlerts', String(catAlerts)) }, [catAlerts])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2200); return () => window.clearTimeout(timer) }, [toast])

  function entrySaved(kind: FlowKind) {
    setEntryOpen(false); loadData()
    if (catAlerts) setToast({ kind, text: kind === 'income' ? 'Gelir eklendi' : 'Gider eklendi' })
  }

  const title = nav.find(x => x.id === page)?.label
  return <div className={`app-shell ${sidebarOpen?'':'sidebar-collapsed'}`}>
    <aside className="sidebar"><div className="logo"><span className="brand-mark">₺</span><span>Harcamac</span><button className="sidebar-toggle" title={sidebarOpen?'Menüyü daralt':'Menüyü aç'} onClick={()=>setSidebarOpen(!sidebarOpen)}>{sidebarOpen?<PanelLeftClose/>:<PanelLeftOpen/>}</button></div><nav data-tour="navigation">{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon /> <span>{item.label}</span></button>)}</nav><div className="sidebar-user"><div className="avatar">{(session.user.user_metadata.full_name || session.user.email || 'H')[0].toUpperCase()}</div><div><b>{session.user.user_metadata.full_name || 'Hesabım'}</b><small>{session.user.email}</small></div><button title="Çıkış yap" onClick={() => supabase.auth.signOut()}><LogOut /></button></div></aside>
    <main className="workspace"><header><div><span className="mobile-logo">Harcamac</span><h1>{title}</h1><p>{page === 'dashboard' ? 'Finansal durumunuza genel bakış' : page === 'transactions' ? 'Tüm gelir ve gider kayıtlarınız' : ''}</p></div><div className="header-actions" data-tour="top-action">{page === 'transactions' && <button className="icon-button" data-tour="category-action" title="Kategoriler" onClick={() => setCategoryOpen(true)}><Tags /></button>}<button className="primary" onClick={() => { setEditEntry(null); setEntryOpen(true) }}><Plus /> <span>Yeni hareket</span></button></div></header>
      {loading ? <div className="loading">Verileriniz getiriliyor…</div> : <>
        {page === 'dashboard' && <Dashboard entries={entries} assets={assets} />}
        {page === 'transactions' && <Transactions entries={entries} categories={categories} onEdit={e => { setEditEntry(e); setEntryOpen(true) }} onDelete={async id => { await supabase.from('entries').delete().eq('id', id); loadData() }} />}
        {page === 'recurring' && <Recurring entries={entries} onEdit={e => { setEditEntry(e); setEntryOpen(true) }} />}
        {page === 'assets' && <Assets />}
        {page === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} email={session.user.email || ''} catAlerts={catAlerts} setCatAlerts={setCatAlerts} openCategories={() => setCategoryOpen(true)} openGuide={() => setGuideOpen(true)} />}
      </>}
    </main>
    <nav className="bottom-nav" data-tour="navigation">{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon/><span>{item.label}</span></button>)}</nav>
    {entryOpen && <EntryModal userId={userId} categories={categories} entry={editEntry} close={() => setEntryOpen(false)} saved={entrySaved} />}
    {categoryOpen && <CategoryModal userId={userId} categories={categories} close={() => setCategoryOpen(false)} reload={loadData} />}
    {setupOpen && <SetupModal userId={userId} close={() => setSetupOpen(false)} saved={() => { setSetupOpen(false); loadData() }} />}
    {guideOpen && <GuideModal close={() => setGuideOpen(false)} />}
    {toast && <CatToast kind={toast.kind} text={toast.text}/>}
  </div>
}

function Dashboard({ entries, assets }: { entries: Entry[]; assets: Asset[] }) {
  const [widgets,setWidgets]=useState<ChartWidget[]>(()=>{try{return JSON.parse(localStorage.getItem('dashboardWidgets')||'')||defaultWidgets}catch{return defaultWidgets}})
  const [editing,setEditing]=useState<ChartWidget|null>(null)
  const [dragging,setDragging]=useState<string|null>(null)
  useEffect(()=>localStorage.setItem('dashboardWidgets',JSON.stringify(widgets)),[widgets])
  const now = new Date(), current = entries.filter(e => { const d = new Date(e.entry_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const income = current.filter(e => e.kind === 'income').reduce((s,e) => s + Number(e.amount), 0)
  const expense = current.filter(e => e.kind === 'expense').reduce((s,e) => s + Number(e.amount), 0)
  const assetTotal = assets.reduce((s,a) => s + Number(a.units) * Number(a.current_price), 0)
  function saveWidget(next:ChartWidget){setWidgets(w=>w.map(x=>x.id===next.id?next:x));setEditing(null)}
  function removeWidget(id:string){setWidgets(w=>w.length>1?w.filter(x=>x.id!==id):w)}
  function moveWidget(target:string){if(!dragging||dragging===target)return;setWidgets(list=>{const from=list.findIndex(x=>x.id===dragging),to=list.findIndex(x=>x.id===target);if(from<0||to<0)return list;const next=[...list], [item]=next.splice(from,1);next.splice(to,0,item);return next})}
  return <div className="page-content">
    <section className="metric-grid"><Metric label="Bu ay gelir" value={income} tone="green"/><Metric label="Bu ay gider" value={expense} tone="red"/><Metric label="Aylık denge" value={income-expense} tone="ink"/><Metric label="Toplam varlık" value={assetTotal} tone="blue"/></section>
    <section className="chart-grid editable" data-tour="charts">{widgets.map(widget=><article className="panel chart-card" key={widget.id} draggable onDragStart={()=>setDragging(widget.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>moveWidget(widget.id)} onDragEnd={()=>setDragging(null)}><ChartHeader widget={widget} edit={()=>setEditing(widget)} remove={()=>removeWidget(widget.id)}/><ChartBody widget={widget} entries={entries}/></article>)}
    </section>
    <section className="panel recent"><PanelTitle title="Son hareketler" subtitle="En yeni kayıtlar"/><EntryRows entries={entries.slice(0,5)}/></section>
    {editing&&<ChartEditor widget={editing} close={()=>setEditing(null)} save={saveWidget}/>}
  </div>
}
function Metric({label,value,tone}:{label:string;value:number;tone:string}) { return <article className={`metric ${tone}`}><small>{label}</small><b>{trMoney.format(value)}</b><span>{tone==='red'?'Aylık harcama':tone==='green'?'Aylık kazanç':'Güncel toplam'}</span></article> }
function PanelTitle({title,subtitle,icon}:{title:string;subtitle:string;icon?:React.ReactNode}) { return <div className="panel-title"><div>{icon}<span><b>{title}</b><small>{subtitle}</small></span></div><button className="icon-button subtle"><Menu/></button></div> }

function ChartHeader({widget,edit,remove}:{widget:ChartWidget;edit:()=>void;remove:()=>void}) { return <div className="panel-title chart-toolbar"><div>{widget.chart==='pie'?<PieIcon/>:<BarChart3/>}<span><b>{widget.title}</b><small>{rangeLabel(widget.range)} · {metricLabel(widget.metric)}</small></span></div><div className="chart-actions"><button title="Düzenle" onClick={edit}><Pencil/></button><button className="danger" title="Sil" onClick={remove}><Trash2/></button></div></div> }
function rangeLabel(range:ChartRange){return range==='month'?'Bu ay':range==='week'?'Bu hafta':'Tüm zamanlar'}
function metricLabel(metric:ChartMetric){return metric==='income'?'Gelir':metric==='expense'?'Gider':metric==='categoryExpense'?'Kategoriye göre gider':'Gelir ve gider'}
function filterRange(entries:Entry[],range:ChartRange){const now=new Date();return entries.filter(e=>{const d=new Date(`${e.entry_date}T12:00:00`);if(range==='all')return true;if(range==='month')return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();const start=new Date(now);start.setDate(now.getDate()-6);return d>=start&&d<=now})}
function chartData(widget:ChartWidget,entries:Entry[]){const list=filterRange(entries,widget.range);if(widget.metric==='categoryExpense')return Object.values(list.filter(e=>e.kind==='expense').reduce((a,e)=>{const key=e.category_name||'Diğer';a[key]||={name:key,value:0};a[key].value+=Number(e.amount);return a},{} as Record<string,{name:string;value:number}>));if(widget.range==='all'){return Array.from({length:6},(_,i)=>{const d=new Date(new Date().getFullYear(),new Date().getMonth()-5+i,1);const month=list.filter(e=>{const x=new Date(`${e.entry_date}T12:00:00`);return x.getMonth()===d.getMonth()&&x.getFullYear()===d.getFullYear()});return {name:d.toLocaleDateString('tr-TR',{month:'short'}),Gelir:month.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.amount),0),Gider:month.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.amount),0)}})}return Object.values(list.reduce((a,e)=>{const key=new Date(`${e.entry_date}T12:00:00`).toLocaleDateString('tr-TR',{day:'numeric',month:'short'});a[key]||={name:key,Gelir:0,Gider:0};a[key][e.kind==='income'?'Gelir':'Gider']+=Number(e.amount);return a},{} as Record<string,{name:string;Gelir:number;Gider:number}>))}
function ChartBody({widget,entries}:{widget:ChartWidget;entries:Entry[]}) { const data=chartData(widget,entries), colors=['#dc5b4f','#e7a23d','#418a73','#477ea8','#8b69a8','#6b7c55']; const total=data.reduce((s:any,x:any)=>s+Number(x.value||0),0); if(widget.chart==='pie'||widget.metric==='categoryExpense')return <div className="donut-wrap"><div className="donut"><ResponsiveContainer><PieChart><Pie data={data.length?data:[{name:'Veri yok',value:1}]} innerRadius="58%" outerRadius="82%" dataKey="value" stroke="none">{(data.length?data:[{}]).map((_,i)=><Cell key={i} fill={data.length?colors[i%colors.length]:'#e4e6e1'}/>)}</Pie><Tooltip formatter={(v:number)=>trMoney.format(v)}/></PieChart></ResponsiveContainer><div><b>{trMoney.format(total)}</b><small>toplam</small></div></div><div className="legend">{data.slice(0,5).map((x:any,i)=><div key={x.name}><span style={{background:colors[i%colors.length]}}/>{x.name}<b>{total?Math.round(x.value/total*100):0}%</b></div>)}</div></div>; return <div className="chart"><ResponsiveContainer>{widget.chart==='area'?<AreaChart data={data}><CartesianGrid vertical={false} stroke="#dfe2dc"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(v:number)=>trMoney.format(v)}/>{widget.metric!=='expense'&&<Area dataKey="Gelir" fill="#3d8b68" stroke="#3d8b68" fillOpacity={.18}/>} {widget.metric!=='income'&&<Area dataKey="Gider" fill="#dc5b4f" stroke="#dc5b4f" fillOpacity={.16}/>}</AreaChart>:<BarChart data={data}><CartesianGrid vertical={false} stroke="#dfe2dc"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(v:number)=>trMoney.format(v)}/>{widget.metric!=='expense'&&<Bar dataKey="Gelir" fill="#3d8b68" radius={[4,4,0,0]}/>} {widget.metric!=='income'&&<Bar dataKey="Gider" fill="#dc5b4f" radius={[4,4,0,0]}/>}</BarChart>}</ResponsiveContainer></div> }
function ChartEditor({widget,close,save}:{widget:ChartWidget;close:()=>void;save:(x:ChartWidget)=>void}) { const [draft,setDraft]=useState(widget); return <Modal title="Grafiği düzenle" close={close}><form className="form-grid" onSubmit={e=>{e.preventDefault();save(draft)}}><label className="full">Başlık<input required value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Grafik tipi<select value={draft.chart} onChange={e=>setDraft({...draft,chart:e.target.value as ChartKind})}><option value="bar">Sütun</option><option value="pie">Pasta</option><option value="area">Alan</option></select></label><label>Zaman dilimi<select value={draft.range} onChange={e=>setDraft({...draft,range:e.target.value as ChartRange})}><option value="month">Aylık</option><option value="week">Haftalık</option><option value="all">Tüm zamanlar</option></select></label><label className="full">Veri<select value={draft.metric} onChange={e=>setDraft({...draft,metric:e.target.value as ChartMetric})}><option value="both">Gelir ve gider</option><option value="income">Gelir</option><option value="expense">Gider</option><option value="categoryExpense">Kategoriye göre gider</option></select></label><div className="form-actions full"><button type="button" onClick={close}>Vazgeç</button><button className="primary">Kaydet</button></div></form></Modal> }

function Transactions({ entries, categories, onEdit, onDelete }: { entries:Entry[];categories:Category[];onEdit:(e:Entry)=>void;onDelete:(id:string)=>void }) {
  const [query,setQuery]=useState(''), [kind,setKind]=useState<'all'|FlowKind>('all'), [cat,setCat]=useState('all'), [sort,setSort]=useState<'date'|'amount'>('date')
  const filtered=useMemo(()=>entries.filter(e=>(kind==='all'||e.kind===kind)&&(cat==='all'||e.category_id===cat)&&(e.title.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))||(e.category_name||'').toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))).sort((a,b)=>sort==='amount'?Number(b.amount)-Number(a.amount):b.entry_date.localeCompare(a.entry_date)),[entries,query,kind,cat,sort])
  const groups=Object.entries(filtered.reduce((a,e)=>{const key=trMonth.format(new Date(`${e.entry_date}T12:00:00`));(a[key]||=[]).push(e);return a},{} as Record<string,Entry[]>))
  return <div className="page-content"><div className="filters" data-tour="filters"><label className="search"><Search/><input placeholder="Hareket ara" value={query} onChange={e=>setQuery(e.target.value)}/></label><select value={kind} onChange={e=>setKind(e.target.value as any)}><option value="all">Tüm türler</option><option value="expense">Giderler</option><option value="income">Gelirler</option></select><select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">Tüm kategoriler</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value as any)}><option value="date">Tarihe göre</option><option value="amount">Tutara göre</option></select></div>
    {groups.length?groups.map(([month,list])=><section className="transaction-group" key={month}><div className="month-title"><b>{month}</b><span>{list.length} hareket</span></div><div className="panel"><EntryRows entries={list} actions={{onEdit,onDelete}}/></div></section>):<Empty text="Henüz hareket bulunmuyor."/>}</div>
}
function EntryRows({entries,actions}:{entries:Entry[];actions?:{onEdit:(e:Entry)=>void;onDelete:(id:string)=>void}}){return <div className="entry-list">{entries.map(e=><div className="entry-row" key={e.id}><div className={`entry-icon ${e.kind}`}><CircleDollarSign/></div><div className="entry-main"><b>{e.title}</b><span>{e.category_name} · {new Date(`${e.entry_date}T12:00:00`).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</span></div><div className={`entry-amount ${e.kind}`}><b>{e.kind==='expense'?'-':'+'}{trMoney.format(Number(e.amount))}</b><span>{e.cadence==='recurring'?'Düzenli':'Tek seferlik'}</span></div>{actions&&<div className="row-actions"><button title="Düzenle" onClick={()=>actions.onEdit(e)}><Pencil/></button><button className="danger" title="Sil" onClick={()=>confirm('Bu hareket silinsin mi?')&&actions.onDelete(e.id)}><Trash2/></button></div>}</div>)}</div>}

function Recurring({entries,onEdit}:{entries:Entry[];onEdit:(e:Entry)=>void}) { const list=entries.filter(e=>e.cadence==='recurring'); const inc=list.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.amount),0), exp=list.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.amount),0); return <div className="page-content"><section className="metric-grid two"><Metric label="Düzenli gelir" value={inc} tone="green"/><Metric label="Düzenli gider" value={exp} tone="red"/></section><section className="panel"><PanelTitle title="Düzenli hareketler" subtitle="Aylık planınız"/><EntryRows entries={list} actions={{onEdit,onDelete:()=>{}}}/></section></div> }

function Assets() { return <div className="page-content"><section className="panel coming-soon"><div className="settings-icon"><WalletCards/></div><h2>Varlıklar geliştirme aşamasında</h2><p>Nakit, altın, hisse, kripto ve diğer varlıkları güncel fiyatlarla izleme bölümü hazırlanıyor. Bu ekran tamamlanana kadar varlık ekleme ve kaldırma işlemleri kapalı.</p></section></div> }

function SettingsPage({theme,setTheme,email,catAlerts,setCatAlerts,openCategories,openGuide}:{theme:'light'|'dark';setTheme:(x:'light'|'dark')=>void;email:string;catAlerts:boolean;setCatAlerts:(x:boolean)=>void;openCategories:()=>void;openGuide:()=>void}) { return <div className="page-content settings-page" data-tour="settings"><section className="panel settings-list"><div className="settings-row"><span className="settings-icon">{theme==='light'?<Sun/>:<Moon/>}</span><span><b>Görünüm</b><small>{theme==='light'?'Açık tema':'Koyu tema'}</small></span><label className="switch"><input type="checkbox" checked={theme==='dark'} onChange={e=>setTheme(e.target.checked?'dark':'light')}/><span/></label></div><div className="settings-row"><span className="settings-icon"><img src={`${import.meta.env.BASE_URL}happy-cat.png`} alt="" /></span><span><b>Kedi bildirimi</b><small>Gelir ve gider kaydında görsel bildirim göster</small></span><label className="switch"><input type="checkbox" checked={catAlerts} onChange={e=>setCatAlerts(e.target.checked)}/><span/></label></div><button onClick={openGuide}><span className="settings-icon"><HelpCircle/></span><span><b>Nasıl kullanılır?</b><small>Ekran üzerinde adım adım göster</small></span><ChevronRight/></button><button onClick={openCategories}><span className="settings-icon"><Tags/></span><span><b>Kategoriler</b><small>Gelir ve gider kategorilerini yönetin</small></span><ChevronRight/></button><button onClick={()=>supabase.auth.signOut()}><span className="settings-icon"><LogOut/></span><span><b>Çıkış yap</b><small>{email}</small></span><ChevronRight/></button></section></div> }

function EntryModal({userId,categories,entry,close,saved}:{userId:string;categories:Category[];entry:Entry|null;close:()=>void;saved:(kind:FlowKind)=>void}) {
  const [kind,setKind]=useState<FlowKind>(entry?.kind||'expense'), [cadence,setCadence]=useState<Cadence>(entry?.cadence||'one_time'), [title,setTitle]=useState(entry?.title||''), [amount,setAmount]=useState(entry?.amount?.toString()||''), [category,setCategory]=useState(entry?.category_id||''), [date,setDate]=useState(entry?.entry_date||today), [installments,setInstallments]=useState(entry?.installment_count?.toString()||''), [busy,setBusy]=useState(false)
  const available=categories.filter(c=>c.kind===kind&&(cadence==='recurring'?c.recurring:c.one_time))
  useEffect(()=>{if(!available.some(c=>c.id===category))setCategory(available[0]?.id||'')},[kind,cadence,categories])
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);const payload={user_id:userId,title:title.trim(),amount:Number(amount.replace(',','.')),category_id:category||null,kind,cadence,entry_date:date,note:'',installment_count:kind==='expense'&&cadence==='recurring'&&Number(installments)>1?Number(installments):null,notification_enabled:false}; const result=entry?await supabase.from('entries').update(payload).eq('id',entry.id):await supabase.from('entries').insert(payload);setBusy(false);if(result.error)alert(result.error.message);else saved(kind)}
  return <Modal title={entry?'Hareketi düzenle':'Harcama kaydı'} close={close}><form className="form-grid" onSubmit={submit}><div className="segment full"><button type="button" className={kind==='expense'?'active expense':''} onClick={()=>setKind('expense')}>Gider</button><button type="button" className={kind==='income'?'active income':''} onClick={()=>setKind('income')}>Gelir</button></div><label>Başlık<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Tutar<input required min="0.01" step="0.01" inputMode="decimal" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Tür<select value={cadence} onChange={e=>setCadence(e.target.value as Cadence)}><option value="one_time">Tek seferlik</option><option value="recurring">Düzenli</option></select></label><label>Kategori<select required value={category} onChange={e=>setCategory(e.target.value)}><option value="">Kategori seçin</option>{available.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Tarih<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{kind==='expense'&&cadence==='recurring'&&<label>Taksit sayısı<input type="number" inputMode="numeric" min="2" max="120" placeholder="Peşin için boş bırakın" value={installments} onChange={e=>setInstallments(e.target.value)}/></label>}<div className="form-actions full"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={busy}>{busy?'Kaydediliyor…':'Kaydet'}</button></div></form></Modal>
}

function GuideModal({close}:{close:()=>void}) {
  const [step,setStep]=useState(0), item=guideSteps[step]
  return <div className={`tour-backdrop tour-${item.spot}`}><div className="tour-hole"/><section className="tour-card"><small>{step+1} / {guideSteps.length}</small><h2>{item.title}</h2><p>{item.text}</p><div className="tour-actions"><button onClick={close}>Kapat</button><span>{guideSteps.map((_,i)=><i key={i} className={i===step?'active':''}/>)}</span><button className="primary" onClick={()=>step===guideSteps.length-1?close():setStep(step+1)}>{step===guideSteps.length-1?'Bitir':'Sonraki'}<ChevronRight/></button></div>{step>0&&<button className="tour-prev" onClick={()=>setStep(step-1)}><ChevronLeft/>Geri</button>}</section></div>
}

function CatToast({kind,text}:{kind:FlowKind;text:string}) { const file=kind==='income'?'happy-cat.png':'sad-cat.png'; return <div className={`cat-toast ${kind}`}><img src={`${import.meta.env.BASE_URL}${file}`} alt=""/><b>{text}</b></div> }

function SetupModal({userId,close,saved}:{userId:string;close:()=>void;saved:()=>void}) {
  const [step,setStep]=useState(0), [selected,setSelected]=useState<string[]>(defaultCategories.map(c=>c.name)), [custom,setCustom]=useState<Omit<Category,'id'|'user_id'>[]>([]), [name,setName]=useState(''), [color,setColor]=useState('#3f8f74'), [kind,setKind]=useState<FlowKind>('expense'), [one,setOne]=useState(true), [recurring,setRecurring]=useState(false), [busy,setBusy]=useState(false)
  const toggle=(name:string)=>setSelected(x=>x.includes(name)?x.filter(y=>y!==name):[...x,name])
  function addCustom(e:FormEvent){e.preventDefault();setCustom(x=>[...x,{name:name.trim(),color,kind,one_time:one,recurring}]);setName('');setOne(true);setRecurring(false)}
  async function finish(){const picked=defaultCategories.filter(c=>selected.includes(c.name));const rows=[...picked,...custom].map(c=>({...c,user_id:userId}));if(!rows.length)return alert('En az bir kategori seçin veya oluşturun.');setBusy(true);const {error}=await supabase.from('categories').insert(rows);setBusy(false);if(error)alert(error.message);else saved()}
  return <Modal title={step===0?'Başlangıç bilgilendirmesi':'Hesap yapılandırması'} close={close}>{step===0?<div className="guide-content"><p className="guide-lead">Harcamac’ta gelir-gider kaydı sağ üstten eklenir, hareketler filtrelerle yönetilir, kategoriler renkleriyle ayrılır. Kurulumdan sonra Ayarlar bölümündeki “Nasıl kullanılır?” tuşu bu bilgileri ekran üzerinde adım adım gösterir.</p><div className="onboarding-cats"><img src={`${import.meta.env.BASE_URL}happy-cat.png`} alt=""/><img src={`${import.meta.env.BASE_URL}sad-cat.png`} alt=""/></div><div className="form-actions"><button className="primary" onClick={()=>setStep(1)}>Kategorileri seç</button></div></div>:<div className="setup-content"><p className="guide-lead">Sık kullanılan kategorileri seçin. İsterseniz kendi kategorinizi renk ve kullanım türüyle birlikte ekleyebilirsiniz.</p><div className="setup-category-grid">{defaultCategories.map(c=><label key={c.name} className={selected.includes(c.name)?'checked':''}><input type="checkbox" checked={selected.includes(c.name)} onChange={()=>toggle(c.name)}/><span className="color-dot" style={{background:c.color}}/><b>{c.name}</b><small>{c.kind==='income'?'Gelir':'Gider'} · {[c.one_time&&'Tek seferlik',c.recurring&&'Düzenli'].filter(Boolean).join(', ')}</small></label>)}</div><form className="category-add setup-add" onSubmit={addCustom}><input required maxLength={60} placeholder="Yeni kategori adı" value={name} onChange={e=>setName(e.target.value)}/><input aria-label="Kategori rengi" type="color" value={color} onChange={e=>setColor(e.target.value)}/><select value={kind} onChange={e=>setKind(e.target.value as FlowKind)}><option value="expense">Gider</option><option value="income">Gelir</option></select><label><input type="checkbox" checked={one} onChange={e=>setOne(e.target.checked)}/> Tek seferlik</label><label><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/> Düzenli</label><button className="primary" disabled={!one&&!recurring}><Plus/>Ekle</button></form>{custom.length>0&&<div className="custom-picked">{custom.map(c=><span key={c.name}><i style={{background:c.color}}/>{c.name}</span>)}</div>}<div className="form-actions"><button type="button" onClick={()=>setStep(0)}>Geri</button><button className="primary" disabled={busy} onClick={finish}>{busy?'Kaydediliyor…':'Kurulumu bitir'}</button></div></div>}</Modal>
}

function CategoryModal({userId,categories,close,reload}:{userId:string;categories:Category[];close:()=>void;reload:()=>void}) { const [name,setName]=useState(''),[color,setColor]=useState('#3f8f74'),[kind,setKind]=useState<FlowKind>('expense'),[one,setOne]=useState(true),[recurring,setRecurring]=useState(false); async function add(e:FormEvent){e.preventDefault();await supabase.from('categories').insert({user_id:userId,name:name.trim(),color,kind,one_time:one,recurring});setName('');reload()} return <Modal title="Kategoriler" close={close}><form className="category-add" onSubmit={add}><input required maxLength={60} placeholder="Kategori adı" value={name} onChange={e=>setName(e.target.value)}/><input aria-label="Kategori rengi" type="color" value={color} onChange={e=>setColor(e.target.value)}/><select value={kind} onChange={e=>setKind(e.target.value as FlowKind)}><option value="expense">Gider</option><option value="income">Gelir</option></select><label><input type="checkbox" checked={one} onChange={e=>setOne(e.target.checked)}/> Tek seferlik</label><label><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/> Düzenli</label><button className="primary" disabled={!one&&!recurring}><Plus/>Ekle</button></form><div className="category-list">{categories.map(c=><div key={c.id}><span className="color-dot" style={{background:c.color}}/><b>{c.name}</b><small>{c.kind==='income'?'Gelir':'Gider'} · {[c.one_time&&'Tek seferlik',c.recurring&&'Düzenli'].filter(Boolean).join(', ')}</small><button className="danger" title="Kategoriyi kaldır" onClick={async()=>{if(confirm('Kategori kaldırılsın mı?')){await supabase.from('categories').delete().eq('id',c.id);reload()}}}><Trash2/></button></div>)}</div></Modal> }

function AssetModal({userId,close,saved}:{userId:string;close:()=>void;saved:()=>void}) { const [name,setName]=useState(''),[symbol,setSymbol]=useState(''),[kind,setKind]=useState('Nakit'),[units,setUnits]=useState(''),[price,setPrice]=useState(''); async function submit(e:FormEvent){e.preventDefault();const {error}=await supabase.from('assets').insert({user_id:userId,name,symbol:symbol.toUpperCase(),kind,units:Number(units),average_cost:Number(price),current_price:Number(price)});if(error)alert(error.message);else saved()} return <Modal title="Varlık ekle" close={close}><form className="form-grid" onSubmit={submit}><label>Varlık adı<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Sembol<input maxLength={12} value={symbol} onChange={e=>setSymbol(e.target.value)}/></label><label>Tür<select value={kind} onChange={e=>setKind(e.target.value)}>{['Nakit','Banka','Hisse','Altın','Kripto','Diğer'].map(x=><option key={x}>{x}</option>)}</select></label><label>Adet / miktar<input required type="number" min="0" step="any" value={units} onChange={e=>setUnits(e.target.value)}/></label><label>Güncel birim fiyat<input required type="number" min="0" step="any" value={price} onChange={e=>setPrice(e.target.value)}/></label><div className="form-actions full"><button type="button" onClick={close}>Vazgeç</button><button className="primary">Kaydet</button></div></form></Modal> }
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><section className="modal"><header><h2>{title}</h2><button className="icon-button" onClick={close}><X/></button></header>{children}</section></div> }
function Empty({text}:{text:string}) { return <div className="empty"><WalletCards/><p>{text}</p></div> }
