import "./Checkout.css"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
	CATALOG, SHIPPING_METHODS, PROMOS, EMPTY_ADDRESS,
	calculateTotals, eur, findPromo, getCartError, updateQuantity, validateAddress,
} from "./checkoutModel.js"

const STEPS = ["Spedizione", "Pagamento", "Riepilogo"]
const ADDRESS_FIELDS = [
	{ name: "email", label: "Email", type: "email", autoComplete: "email", span: 2, placeholder: "nome@esempio.it", maxLength: 254 },
	{ name: "firstName", label: "Nome", autoComplete: "given-name", maxLength: 80 },
	{ name: "lastName", label: "Cognome", autoComplete: "family-name", maxLength: 80 },
	{ name: "address", label: "Indirizzo", autoComplete: "address-line1", span: 2, placeholder: "Via e numero civico", maxLength: 160 },
	{ name: "city", label: "Città", autoComplete: "address-level2", maxLength: 80 },
	{ name: "zip", label: "CAP", autoComplete: "postal-code", inputMode: "numeric", placeholder: "00100", maxLength: 5 },
	{ name: "province", label: "Provincia (facoltativa)", autoComplete: "address-level1", placeholder: "RM", maxLength: 2, optional: true },
]

/**
 * Remote montabile anche da solo, con carrello demo di fallback.
 * `items` conserva la forma { id, name, price, qty, variant?, emoji? }.
 * `onOrderPlaced` resta una prop riservata all'integrazione esistente: non viene
 * invocata in assenza di un servizio verificato che crei un ordine reale.
 */
export const Checkout = ({ items: initialItems = CATALOG } = {}) => {
	const prefix = useId()
	const [step, setStep] = useState(0)
	const [cart, setCart] = useState({ source: initialItems, items: initialItems })
	// Un nuovo carrello dello host è visibile subito, senza confermare dati obsoleti.
	const items = cart.source === initialItems ? cart.items : initialItems
	const [address, setAddress] = useState(EMPTY_ADDRESS)
	const [shipping, setShipping] = useState("standard")
	const [promoInput, setPromoInput] = useState("")
	const [promo, setPromo] = useState(null)
	const [promoError, setPromoError] = useState("")
	const [errors, setErrors] = useState({})
	const [processing, setProcessing] = useState(false)
	const [submitError, setSubmitError] = useState("")
	const [reviewedCart, setReviewedCart] = useState(null)
	const submitLock = useRef(false)
	const verificationSnapshot = useRef(null)
	const formRef = useRef(null)
	const titleRef = useRef(null)
	const noticeRef = useRef(null)
	const previousStep = useRef(step)
	const pendingFocus = useRef(null)

	const cartError = useMemo(() => getCartError(items), [items])
	const totals = useMemo(() => calculateTotals(items, shipping, promo), [items, shipping, promo])
	const shippingMethod = SHIPPING_METHODS.find((m) => m.id === shipping)
	const safeItems = cartError ? [] : items
	const empty = !cartError && items.length === 0
	const blocked = Boolean(cartError || empty || !totals)
	const demoReviewed = reviewedCart !== null && reviewedCart === items && !blocked

	useEffect(() => {
		setCart((prev) => prev.source === initialItems ? prev : { source: initialItems, items: initialItems })
		setReviewedCart(null)
		setSubmitError("")
	}, [initialItems])

	useEffect(() => {
		if (pendingFocus.current) {
			formRef.current?.elements.namedItem(pendingFocus.current)?.focus()
			pendingFocus.current = null
		} else if (previousStep.current !== step) {
			titleRef.current?.focus()
		}
		previousStep.current = step
	}, [step, errors])

	useEffect(() => {
		if (demoReviewed) noticeRef.current?.focus()
	}, [demoReviewed])

	useEffect(() => {
		if (!processing) return
		// Verifica locale al frame successivo, senza attese finte né richieste di pagamento.
		// La cleanup annulla il lavoro se il componente viene smontato o i dati cambiano.
		const frame = window.requestAnimationFrame(() => {
			try {
				const snapshot = verificationSnapshot.current
				const changed = !snapshot || snapshot.items !== items || snapshot.address !== address ||
					snapshot.shipping !== shipping || snapshot.promo !== promo
				const nextErrors = validateAddress(address)
				if (changed || cartError || !items.length || !calculateTotals(items, shipping, promo)) {
					setSubmitError("Il carrello è cambiato o non è valido. Controlla il riepilogo prima di riprovare.")
				} else if (Object.keys(nextErrors).length) {
					pendingFocus.current = Object.keys(nextErrors)[0]
					setErrors(nextErrors)
					setStep(0)
				} else {
					setReviewedCart(items)
					setSubmitError("")
				}
			} catch {
				setSubmitError("Non è stato possibile verificare il riepilogo. Riprova: nessun ordine è stato creato.")
			} finally {
				verificationSnapshot.current = null
				submitLock.current = false
				setProcessing(false)
			}
		})
		return () => window.cancelAnimationFrame(frame)
	}, [processing, items, address, shipping, promo, cartError])

	const invalidateReview = () => {
		setReviewedCart(null)
		setSubmitError("")
	}

	const goToStep = (nextStep) => {
		if (submitLock.current) return
		invalidateReview()
		setErrors({})
		setStep(nextStep)
	}

	const field = (name, value) => {
		if (submitLock.current) return
		invalidateReview()
		setAddress((prev) => ({ ...prev, [name]: value }))
		setErrors((prev) => ({ ...prev, [name]: undefined }))
	}

	const setQty = (id, delta) => {
		if (submitLock.current) return
		const next = updateQuantity(items, id, delta)
		if (!calculateTotals(next, shipping, promo)) return
		invalidateReview()
		setCart({ source: initialItems, items: next })
	}

	const applyPromo = (event) => {
		event.preventDefault()
		if (submitLock.current || blocked) return
		const code = findPromo(promoInput)
		if (code) {
			invalidateReview()
			setPromo(code)
			setPromoError("")
			setPromoInput("")
		} else {
			setPromoError("Codice demo non valido. Puoi provare SANDBOX10.")
		}
	}

	const submit = (event) => {
		event.preventDefault()
		if (submitLock.current || blocked || demoReviewed) return
		if (step === 0) {
			const nextErrors = validateAddress(address)
			setErrors(nextErrors)
			if (Object.keys(nextErrors).length) {
				pendingFocus.current = Object.keys(nextErrors)[0]
				return
			}
		}
		if (step < 2) {
			// Più eventi nello stesso frame non devono saltare un passaggio.
			setStep(step + 1)
		} else {
			// Il ref impedisce anche due invii nello stesso frame, prima del render.
			submitLock.current = true
			verificationSnapshot.current = { items, address, shipping, promo }
			setSubmitError("")
			setProcessing(true)
		}
	}

	return (
		<div className="co-root" lang="it">
			<div className="co-content">
				<header className="co-header">
					<div className="co-brand">
						<span className="co-brand-mark" aria-hidden="true">◈</span> Sandbox Store
					</div>
					<span className="co-demo-badge">Anteprima checkout</span>
				</header>
				<div className="co-intro">
					<p className="co-eyebrow">Un ultimo controllo, con calma</p>
					<h1>Il tuo checkout</h1>
					<p className="co-muted">Contatti, consegna e riepilogo: tutto in un unico posto.</p>
				</div>
				<div className="co-demo-note">
					<span className="co-note-mark" aria-hidden="true">i</span>
					<p><strong>Modalità dimostrativa.</strong> Nessun ordine, pagamento o email verrà inviato. Usa dati di esempio, non dati personali reali. Spedizioni, sconti e totali sono illustrativi.</p>
				</div>

				<nav aria-label="Avanzamento del checkout">
					<ol className="co-steps">
						{STEPS.map((label, i) => (
							<li key={label} aria-current={i === step ? "step" : undefined}
								className={`co-step ${i === step ? "is-active" : ""} ${i < step ? "is-done" : ""}`}>
								<span className="co-step-dot" aria-hidden="true">{i < step ? "✓" : i + 1}</span>
								<span>{label}<span className="co-sr-only">{i < step ? ", completato" : ""}</span></span>
							</li>
						))}
					</ol>
				</nav>

				<div className="co-layout">
					<section className="co-panel" aria-labelledby={`${prefix}-title`}>
						{blocked ? (
							<div className="co-empty">
								<span className="co-empty-icon" aria-hidden="true">◇</span>
								<h2 id={`${prefix}-title`}>{empty ? "Il carrello è vuoto" : "Carrello non disponibile"}</h2>
								<p role={empty ? "status" : "alert"} className="co-muted">
									{empty ? "Aggiungi un prodotto dal catalogo per iniziare il checkout." : cartError || "Gli importi non sono validi. Aggiorna il carrello dalla shell."}
								</p>
								{initialItems === CATALOG && empty && (
									<button type="button" className="co-btn co-btn-primary" disabled={processing} onClick={() => {
										invalidateReview()
										setCart({ source: initialItems, items: CATALOG })
										setStep(0)
									}}>Ripristina prodotti demo</button>
								)}
							</div>
						) : (
							<form ref={formRef} noValidate onSubmit={submit} aria-busy={processing}>
								<p className="co-eyebrow">Passaggio {step + 1} di 3</p>
								<h2 id={`${prefix}-title`} className="co-title" ref={titleRef} tabIndex={-1}>
									{["Dove spediamo?", "Pagamento, senza dati sensibili", "Controlla il riepilogo"][step]}
								</h2>
								{Object.values(errors).some(Boolean) && (
									<div className="co-error-summary" role="alert">
										<strong>Controlla i campi indicati.</strong>
										<ul>
											{ADDRESS_FIELDS.filter((f) => errors[f.name]).map((f) => (
												<li key={f.name}>
													<button type="button" className="co-link" onClick={() => formRef.current?.elements.namedItem(f.name)?.focus()}>
														{f.label}: {errors[f.name]}
													</button>
												</li>
											))}
										</ul>
									</div>
								)}

								<fieldset className="co-form-body" disabled={processing}>
									<legend className="co-sr-only">{STEPS[step]}</legend>
									{step === 0 && (
										<>
											<p className="co-muted co-description">Indirizzo in Italia. Tutti i campi sono obbligatori, salvo la provincia.</p>
											<div className="co-grid">
												{ADDRESS_FIELDS.map((f) => (
													<Field key={f.name} {...f} id={`${prefix}-${f.name}`} error={errors[f.name]}
														value={address[f.name]} onChange={(v) => field(f.name, v)} />
												))}
											</div>
											<fieldset className="co-shipping">
												<legend className="co-subtitle">Opzioni di spedizione demo</legend>
												<div className="co-options">
													{SHIPPING_METHODS.map((m) => (
														<label key={m.id} className={`co-option ${shipping === m.id ? "is-selected" : ""}`}>
															<input type="radio" name={`${prefix}-shipping`} value={m.id} checked={shipping === m.id}
																onChange={() => { invalidateReview(); setShipping(m.id) }} />
															<span className="co-option-body">
																<strong>{m.label}</strong><span className="co-muted">{m.eta}</span>
															</span>
															<span className="co-option-price">{m.price === 0 ? "Gratis" : eur(m.price)}</span>
														</label>
													))}
												</div>
											</fieldset>
										</>
									)}
									{step === 1 && (
										<div className="co-payment-note">
											<span className="co-payment-icon" aria-hidden="true">▤</span>
											<h3>Nessun metodo di pagamento collegato</h3>
											<p className="co-muted">Questo checkout non dispone di un servizio di pagamento verificato. Non ti chiederemo numero di carta, scadenza o CVC.</p>
											<p>Puoi continuare per controllare il riepilogo demo, senza addebiti e senza creare un ordine.</p>
										</div>
									)}
									{step === 2 && (
										<div className="co-review">
											<ReviewRow title="Contatti e indirizzo" onEdit={() => goToStep(0)} lines={[
												`${address.firstName.trim()} ${address.lastName.trim()}`,
												address.address.trim(),
												`${address.zip.trim()} ${address.city.trim()} ${address.province.trim().toUpperCase()}`,
												"Italia", address.email.trim(),
											]} />
											<ReviewRow title="Spedizione demo" onEdit={() => goToStep(0)} lines={[shippingMethod.label, shippingMethod.eta]} />
											<ReviewRow title="Pagamento" onEdit={() => goToStep(1)} lines={["Non disponibile in questa demo", "Nessun addebito verrà effettuato"]} />
										</div>
									)}
								</fieldset>

								{submitError && <p className="co-error-summary" role="alert">{submitError}</p>}
								{demoReviewed && (
									<div className="co-demo-result" ref={noticeRef} tabIndex={-1} role="status">
										<strong>Riepilogo demo verificato</strong>
										<p>Nessun ordine è stato creato, nessun pagamento eseguito e nessuna email inviata. Per un acquisto reale occorre collegare servizi di checkout e pagamento.</p>
									</div>
								)}
								<div className="co-actions">
									{step > 0 && (
										<button type="button" className="co-btn co-btn-ghost" disabled={processing} onClick={() => goToStep(step - 1)}>Indietro</button>
									)}
									<button type="submit" className="co-btn co-btn-primary" disabled={processing || demoReviewed}>
										{processing ? <><span className="co-spinner" aria-hidden="true" /> Verifica locale…</> : step < 2 ? "Continua" : demoReviewed ? "Riepilogo verificato" : "Verifica riepilogo demo"}
									</button>
								</div>
								<p className="co-hint co-muted" role="status">
									{processing ? "Verifica locale in corso. Nessun dato viene inviato." : "I dati restano solo nella memoria di questa pagina."}
								</p>
							</form>
						)}
					</section>

					<aside className="co-summary" aria-labelledby={`${prefix}-summary`}>
						<div className="co-summary-heading">
							<h2 id={`${prefix}-summary`}>Il tuo carrello</h2>
							<span className="co-count">{safeItems.length} {safeItems.length === 1 ? "prodotto" : "prodotti"}</span>
						</div>
						<ul className="co-items">
							{safeItems.map((item) => {
								const increased = updateQuantity(items, item.id, 1)
								const canIncrease = increased !== items && Boolean(calculateTotals(increased, shipping, promo))
								return (
									<li key={item.id} className="co-item">
										<span className="co-thumb" aria-hidden="true">{typeof item.emoji === "string" ? item.emoji : "◇"}</span>
										<div className="co-item-info">
											<strong>{item.name}</strong>
											{typeof item.variant === "string" && <span className="co-muted">{item.variant}</span>}
											<div className="co-stepper" role="group" aria-label={`Quantità di ${item.name}`}>
												<button type="button" disabled={processing} onClick={() => setQty(item.id, -1)}
													aria-label={item.qty === 1 ? `Rimuovi ${item.name} dal carrello` : `Riduci la quantità di ${item.name}`}>−</button>
												<span>{item.qty}</span>
												<button type="button" disabled={processing || !canIncrease} onClick={() => setQty(item.id, 1)}
													aria-label={`Aumenta la quantità di ${item.name}`}>+</button>
											</div>
										</div>
										<span className="co-item-price">{eur(Math.round(item.price * 100) * item.qty / 100)}</span>
									</li>
								)
							})}
							{!safeItems.length && <li className="co-muted">{cartError ? "Prodotti non disponibili." : "Nessun prodotto nel carrello."}</li>}
						</ul>

						<form onSubmit={applyPromo} className="co-promo-form">
							<label htmlFor={`${prefix}-promo`}>Codice sconto demo</label>
							<div className="co-promo">
								<input id={`${prefix}-promo`} name="promo" placeholder="Es. SANDBOX10" value={promoInput} maxLength={32}
									disabled={processing || blocked} aria-invalid={Boolean(promoError)}
									aria-describedby={promoError ? `${prefix}-promo-error` : undefined}
									onChange={(e) => { setPromoInput(e.target.value); setPromoError("") }} />
								<button type="submit" className="co-btn co-btn-ghost" disabled={processing || blocked}>Applica</button>
							</div>
							{promoError && <p id={`${prefix}-promo-error`} className="co-error" role="alert">{promoError}</p>}
						</form>
						<div role="status">
							{promo && (
								<span className="co-promo-tag">
									{PROMOS[promo].label}
									<button type="button" disabled={processing} onClick={() => { invalidateReview(); setPromo(null); setPromoError("") }}
										aria-label={`Rimuovi lo sconto ${promo}`}>×</button>
								</span>
							)}
						</div>

						{totals && (
							<dl className="co-totals" aria-live="polite" aria-atomic="true">
								<div><dt>Subtotale (IVA esclusa)</dt><dd>{eur(totals.subtotal)}</dd></div>
								{totals.discount > 0 && <div className="co-discount"><dt>Sconto demo</dt><dd>−{eur(totals.discount)}</dd></div>}
								<div><dt>Spedizione demo</dt><dd>{empty ? "—" : totals.shipping === 0 ? "Gratis" : eur(totals.shipping)}</dd></div>
								<div><dt>IVA demo (22%)</dt><dd>{eur(totals.vat)}</dd></div>
								<div className="co-total-row"><dt>Totale demo</dt><dd>{eur(totals.total)}</dd></div>
							</dl>
						)}
						<p className="co-hint co-muted">Importi calcolati localmente. Prezzi e disponibilità non verificati da un servizio.</p>
					</aside>
				</div>
			</div>
		</div>
	)
}

const Field = ({ id, name, label, value, onChange, error, placeholder, span = 1, type = "text", autoComplete, inputMode, maxLength, optional }) => (
	<div className={`co-field ${span === 2 ? "co-span-2" : ""}`}>
		<label htmlFor={id}>{label}</label>
		<input id={id} name={name} type={type} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength}
			required={!optional} value={value} placeholder={placeholder} className={error ? "has-error" : ""}
			aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
			onChange={(e) => onChange(e.target.value)} />
		{error && <span id={`${id}-error`} className="co-error">{error}</span>}
	</div>
)

const ReviewRow = ({ title, lines, onEdit }) => (
	<div className="co-review-row">
		<div>
			<span className="co-review-title">{title}</span>
			{lines.filter(Boolean).map((line, i) => <span key={i} className="co-review-line">{line}</span>)}
		</div>
		<button type="button" className="co-link" onClick={onEdit} aria-label={`Modifica: ${title}`}>Modifica</button>
	</div>
)

export default Checkout
