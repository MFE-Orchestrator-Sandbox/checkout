import "./Checkout.css"

import { useMemo, useState } from "react"

const CATALOG = [
	{
		id: "sku-anodized-lamp",
		name: "Lampada Anodized",
		variant: "Alluminio / Warm 2700K",
		price: 149,
		qty: 1,
		emoji: "🛋️",
	},
	{
		id: "sku-linen-throw",
		name: "Plaid in lino lavato",
		variant: "Sabbia / 130x180",
		price: 89,
		qty: 2,
		emoji: "🧺",
	},
	{
		id: "sku-ceramic-mug",
		name: "Tazza in gres",
		variant: "Verde salvia / 350ml",
		price: 24,
		qty: 1,
		emoji: "☕",
	},
]

const SHIPPING_METHODS = [
	{ id: "standard", label: "Standard", eta: "3-5 giorni lavorativi", price: 0 },
	{ id: "express", label: "Express", eta: "entro domani", price: 9.9 },
	{ id: "pickup", label: "Ritiro in negozio", eta: "oggi, dalle 17:00", price: 0 },
]

const PROMOS = {
	SANDBOX10: { label: "Sconto sandbox 10%", rate: 0.1 },
	MFE20: { label: "Sconto federation 20%", rate: 0.2 },
}

const VAT_RATE = 0.22
const STEPS = ["Spedizione", "Pagamento", "Conferma"]

const eur = (n) =>
	new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n)

const cardBrand = (digits) => {
	if (digits.startsWith("4")) return "VISA"
	if (/^5[1-5]/.test(digits)) return "Mastercard"
	if (/^3[47]/.test(digits)) return "Amex"
	return null
}

const formatCardNumber = (raw) =>
	raw
		.replace(/\D/g, "")
		.slice(0, 16)
		.replace(/(.{4})/g, "$1 ")
		.trim()

const formatExpiry = (raw) => {
	const d = raw.replace(/\D/g, "").slice(0, 4)
	return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

const EMPTY_ADDRESS = {
	email: "",
	firstName: "",
	lastName: "",
	address: "",
	city: "",
	zip: "",
	province: "",
}

/**
 * Checkout in tre step. Riceve il carrello dallo host tramite `items` e gli
 * restituisce l'ordine creato con `onOrderPlaced`; senza prop ricade sul
 * catalogo demo, così il remote resta montabile anche da solo.
 */
export const Checkout = ({ items: initialItems = CATALOG, onOrderPlaced }) => {
	const [step, setStep] = useState(0)
	const [items, setItems] = useState(initialItems)
	const [address, setAddress] = useState(EMPTY_ADDRESS)
	const [shipping, setShipping] = useState("standard")
	const [payment, setPayment] = useState("card")
	const [card, setCard] = useState({ number: "", holder: "", expiry: "", cvc: "" })
	const [promoInput, setPromoInput] = useState("")
	const [promo, setPromo] = useState(null)
	const [promoError, setPromoError] = useState("")
	const [errors, setErrors] = useState({})
	const [processing, setProcessing] = useState(false)
	const [orderId, setOrderId] = useState(null)

	const shippingMethod = SHIPPING_METHODS.find((m) => m.id === shipping)

	const totals = useMemo(() => {
		const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0)
		const discount = promo ? subtotal * PROMOS[promo].rate : 0
		const taxable = subtotal - discount
		const vat = taxable * VAT_RATE
		return {
			subtotal,
			discount,
			vat,
			shipping: shippingMethod.price,
			total: taxable + vat + shippingMethod.price,
		}
	}, [items, promo, shippingMethod])

	const setQty = (id, delta) =>
		setItems((prev) =>
			prev
				.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
				.filter((i) => i.qty > 0)
		)

	const field = (name, value) => {
		setAddress((prev) => ({ ...prev, [name]: value }))
		setErrors((prev) => ({ ...prev, [name]: undefined }))
	}

	const applyPromo = () => {
		const code = promoInput.trim().toUpperCase()
		if (PROMOS[code]) {
			setPromo(code)
			setPromoError("")
			setPromoInput("")
		} else {
			setPromo(null)
			setPromoError("Codice non valido. Prova SANDBOX10.")
		}
	}

	const validateAddress = () => {
		const next = {}
		if (!/^\S+@\S+\.\S+$/.test(address.email)) next.email = "Email non valida"
		if (!address.firstName.trim()) next.firstName = "Obbligatorio"
		if (!address.lastName.trim()) next.lastName = "Obbligatorio"
		if (!address.address.trim()) next.address = "Obbligatorio"
		if (!address.city.trim()) next.city = "Obbligatorio"
		if (!/^\d{5}$/.test(address.zip)) next.zip = "5 cifre"
		setErrors(next)
		return Object.keys(next).length === 0
	}

	const validatePayment = () => {
		if (payment !== "card") return true
		const next = {}
		if (card.number.replace(/\s/g, "").length < 16) next.number = "16 cifre"
		if (!card.holder.trim()) next.holder = "Obbligatorio"
		if (!/^\d{2}\/\d{2}$/.test(card.expiry)) next.expiry = "MM/AA"
		if (card.cvc.length < 3) next.cvc = "3 cifre"
		setErrors(next)
		return Object.keys(next).length === 0
	}

	const next = () => {
		if (step === 0 && !validateAddress()) return
		if (step === 1 && !validatePayment()) return
		setErrors({})
		setStep((s) => s + 1)
	}

	const pay = () => {
		setProcessing(true)
		// Nessun pagamento reale: solo una latenza finta per mostrare lo stato di loading.
		setTimeout(() => {
			const id = `MFE-${Math.floor(100000 + Math.random() * 899999)}`
			setProcessing(false)
			setOrderId(id)
			onOrderPlaced?.({
				id,
				customer: `${address.firstName} ${address.lastName}`.trim(),
				email: address.email,
				total: totals.total,
				shipping: shippingMethod.label,
				items: items.map((i) => ({
					sku: i.id,
					name: i.name,
					qty: i.qty,
					price: i.price,
				})),
			})
		}, 1800)
	}

	const reset = () => {
		setOrderId(null)
		setStep(0)
		setItems(initialItems)
		setAddress(EMPTY_ADDRESS)
		setCard({ number: "", holder: "", expiry: "", cvc: "" })
		setPromo(null)
		setShipping("standard")
	}

	if (orderId) {
		return (
			<div className="co-root">
				<div className="co-success">
					<div className="co-success-badge">✓</div>
					<h2>Ordine confermato</h2>
					<p className="co-muted">
						Abbiamo inviato la conferma a <strong>{address.email}</strong>.
					</p>
					<dl className="co-success-meta">
						<div>
							<dt>Numero ordine</dt>
							<dd>{orderId}</dd>
						</div>
						<div>
							<dt>Totale</dt>
							<dd>{eur(totals.total)}</dd>
						</div>
						<div>
							<dt>Consegna</dt>
							<dd>{shippingMethod.eta}</dd>
						</div>
					</dl>
					<button className="co-btn co-btn-primary" onClick={reset}>
						Nuovo checkout
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="co-root">
			<header className="co-header">
				<div className="co-brand">
					<span className="co-brand-mark">◈</span> Sandbox Store
				</div>
				<span className="co-secure">🔒 Demo — nessun pagamento reale</span>
			</header>

			<ol className="co-steps">
				{STEPS.map((label, i) => (
					<li
						key={label}
						className={`co-step ${i === step ? "is-active" : ""} ${
							i < step ? "is-done" : ""
						}`}>
						<span className="co-step-dot">{i < step ? "✓" : i + 1}</span>
						{label}
					</li>
				))}
			</ol>

			<div className="co-layout">
				<main className="co-panel">
					{step === 0 && (
						<>
							<h2 className="co-title">Dove spediamo?</h2>
							<div className="co-grid">
								<Field
									label="Email"
									span={2}
									error={errors.email}
									value={address.email}
									onChange={(v) => field("email", v)}
									placeholder="nome@esempio.it"
								/>
								<Field
									label="Nome"
									error={errors.firstName}
									value={address.firstName}
									onChange={(v) => field("firstName", v)}
								/>
								<Field
									label="Cognome"
									error={errors.lastName}
									value={address.lastName}
									onChange={(v) => field("lastName", v)}
								/>
								<Field
									label="Indirizzo"
									span={2}
									error={errors.address}
									value={address.address}
									onChange={(v) => field("address", v)}
									placeholder="Via, numero civico"
								/>
								<Field
									label="Città"
									error={errors.city}
									value={address.city}
									onChange={(v) => field("city", v)}
								/>
								<Field
									label="CAP"
									error={errors.zip}
									value={address.zip}
									onChange={(v) => field("zip", v.replace(/\D/g, "").slice(0, 5))}
									placeholder="00100"
								/>
							</div>

							<h3 className="co-subtitle">Metodo di spedizione</h3>
							<div className="co-options">
								{SHIPPING_METHODS.map((m) => (
									<label
										key={m.id}
										className={`co-option ${shipping === m.id ? "is-selected" : ""}`}>
										<input
											type="radio"
											name="shipping"
											checked={shipping === m.id}
											onChange={() => setShipping(m.id)}
										/>
										<span className="co-option-body">
											<strong>{m.label}</strong>
											<span className="co-muted">{m.eta}</span>
										</span>
										<span className="co-option-price">
											{m.price === 0 ? "Gratis" : eur(m.price)}
										</span>
									</label>
								))}
							</div>
						</>
					)}

					{step === 1 && (
						<>
							<h2 className="co-title">Come vuoi pagare?</h2>
							<div className="co-options">
								{[
									{ id: "card", label: "Carta di credito", hint: "Visa, Mastercard, Amex" },
									{ id: "paypal", label: "PayPal", hint: "Verrai reindirizzato" },
									{ id: "transfer", label: "Bonifico", hint: "Spedizione dopo l'accredito" },
								].map((m) => (
									<label
										key={m.id}
										className={`co-option ${payment === m.id ? "is-selected" : ""}`}>
										<input
											type="radio"
											name="payment"
											checked={payment === m.id}
											onChange={() => {
												setPayment(m.id)
												setErrors({})
											}}
										/>
										<span className="co-option-body">
											<strong>{m.label}</strong>
											<span className="co-muted">{m.hint}</span>
										</span>
									</label>
								))}
							</div>

							{payment === "card" && (
								<div className="co-card-form">
									<div className="co-grid">
										<div className="co-field co-span-2">
											<label>Numero carta</label>
											<div className="co-input-wrap">
												<input
													inputMode="numeric"
													placeholder="0000 0000 0000 0000"
													value={card.number}
													onChange={(e) =>
														setCard((c) => ({
															...c,
															number: formatCardNumber(e.target.value),
														}))
													}
												/>
												{cardBrand(card.number.replace(/\s/g, "")) && (
													<span className="co-brand-chip">
														{cardBrand(card.number.replace(/\s/g, ""))}
													</span>
												)}
											</div>
											{errors.number && <span className="co-error">{errors.number}</span>}
										</div>
										<Field
											label="Intestatario"
											span={2}
											error={errors.holder}
											value={card.holder}
											onChange={(v) => setCard((c) => ({ ...c, holder: v.toUpperCase() }))}
											placeholder="COME STAMPATO SULLA CARTA"
										/>
										<Field
											label="Scadenza"
											error={errors.expiry}
											value={card.expiry}
											onChange={(v) => setCard((c) => ({ ...c, expiry: formatExpiry(v) }))}
											placeholder="MM/AA"
										/>
										<Field
											label="CVC"
											error={errors.cvc}
											value={card.cvc}
											onChange={(v) =>
												setCard((c) => ({ ...c, cvc: v.replace(/\D/g, "").slice(0, 4) }))
											}
											placeholder="123"
										/>
									</div>
									<p className="co-muted co-hint">
										Dati finti: la form non invia nulla da nessuna parte.
									</p>
								</div>
							)}
						</>
					)}

					{step === 2 && (
						<>
							<h2 className="co-title">Controlla e conferma</h2>
							<div className="co-review">
								<ReviewRow
									title="Spedizione"
									onEdit={() => setStep(0)}
									lines={[
										`${address.firstName} ${address.lastName}`,
										address.address,
										`${address.zip} ${address.city}`,
										address.email,
									]}
								/>
								<ReviewRow
									title="Metodo"
									onEdit={() => setStep(0)}
									lines={[shippingMethod.label, shippingMethod.eta]}
								/>
								<ReviewRow
									title="Pagamento"
									onEdit={() => setStep(1)}
									lines={
										payment === "card"
											? [
													`${cardBrand(card.number.replace(/\s/g, "")) ?? "Carta"} •••• ${card.number.slice(-4)}`,
													`Scad. ${card.expiry}`,
											  ]
											: [payment === "paypal" ? "PayPal" : "Bonifico bancario"]
									}
								/>
							</div>
						</>
					)}

					<div className="co-actions">
						{step > 0 && (
							<button className="co-btn co-btn-ghost" onClick={() => setStep((s) => s - 1)}>
								Indietro
							</button>
						)}
						{step < 2 ? (
							<button className="co-btn co-btn-primary" onClick={next}>
								Continua
							</button>
						) : (
							<button
								className="co-btn co-btn-primary"
								onClick={pay}
								disabled={processing}>
								{processing ? (
									<>
										<span className="co-spinner" /> Elaborazione…
									</>
								) : (
									`Paga ${eur(totals.total)}`
								)}
							</button>
						)}
					</div>
				</main>

				<aside className="co-summary">
					<h3 className="co-subtitle">Il tuo ordine</h3>
					<ul className="co-items">
						{items.map((item) => (
							<li key={item.id} className="co-item">
								<span className="co-thumb">{item.emoji}</span>
								<div className="co-item-info">
									<strong>{item.name}</strong>
									<span className="co-muted">{item.variant}</span>
									<div className="co-stepper">
										<button onClick={() => setQty(item.id, -1)} aria-label="Riduci">
											−
										</button>
										<span>{item.qty}</span>
										<button onClick={() => setQty(item.id, 1)} aria-label="Aumenta">
											+
										</button>
									</div>
								</div>
								<span className="co-item-price">{eur(item.price * item.qty)}</span>
							</li>
						))}
						{items.length === 0 && <li className="co-muted">Il carrello è vuoto.</li>}
					</ul>

					<div className="co-promo">
						<input
							placeholder="Codice sconto"
							value={promoInput}
							onChange={(e) => setPromoInput(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && applyPromo()}
						/>
						<button className="co-btn co-btn-ghost" onClick={applyPromo}>
							Applica
						</button>
					</div>
					{promoError && <span className="co-error">{promoError}</span>}
					{promo && (
						<span className="co-promo-tag">
							{promo} — {PROMOS[promo].label}
							<button onClick={() => setPromo(null)} aria-label="Rimuovi">
								×
							</button>
						</span>
					)}

					<dl className="co-totals">
						<div>
							<dt>Subtotale</dt>
							<dd>{eur(totals.subtotal)}</dd>
						</div>
						{totals.discount > 0 && (
							<div className="co-discount">
								<dt>Sconto</dt>
								<dd>−{eur(totals.discount)}</dd>
							</div>
						)}
						<div>
							<dt>Spedizione</dt>
							<dd>{totals.shipping === 0 ? "Gratis" : eur(totals.shipping)}</dd>
						</div>
						<div>
							<dt>IVA (22%)</dt>
							<dd>{eur(totals.vat)}</dd>
						</div>
						<div className="co-total-row">
							<dt>Totale</dt>
							<dd>{eur(totals.total)}</dd>
						</div>
					</dl>
				</aside>
			</div>
		</div>
	)
}

const Field = ({ label, value, onChange, error, placeholder, span = 1 }) => (
	<div className={`co-field ${span === 2 ? "co-span-2" : ""}`}>
		<label>{label}</label>
		<input
			value={value}
			placeholder={placeholder}
			className={error ? "has-error" : ""}
			onChange={(e) => onChange(e.target.value)}
		/>
		{error && <span className="co-error">{error}</span>}
	</div>
)

const ReviewRow = ({ title, lines, onEdit }) => (
	<div className="co-review-row">
		<div>
			<span className="co-review-title">{title}</span>
			{lines.filter(Boolean).map((line, i) => (
				<span key={i} className="co-review-line">
					{line}
				</span>
			))}
		</div>
		<button className="co-link" onClick={onEdit}>
			Modifica
		</button>
	</div>
)

export default Checkout
