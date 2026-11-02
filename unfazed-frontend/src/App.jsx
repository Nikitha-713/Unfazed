import { useEffect, useState } from "react";
import "./App.css";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("unfazedToken");

  const response = await fetch(`${API}/workspace${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  // Some error responses may not contain JSON.
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong");
    error.status = response.status;
    throw error;
  }

  return data;
}

const fallbackPlans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "For getting started",
    features: [
      "Client management",
      "Appointment scheduling",
      "Clinical notes",
      "Up to 10 clients",
      "Up to 20 clinical notes"
    ]
  },
  {
    id: "professional",
    name: "Professional",
    price: 499,
    description: "For growing practices",
    features: [
      "Everything in Free",
      "Payment management",
      "Messaging",
      "Advanced analytics",
      "Up to 100 clients",
      "Up to 500 clinical notes"
    ]
  },
  {
    id: "premium",
    name: "Premium",
    price: 999,
    description: "For established practices",
    features: [
      "Everything in Professional",
      "Unlimited clients",
      "Unlimited clinical notes",
      "All platform features",
      "Advanced analytics"
    ]
  }
];

function App() {
  const [page, setPage] = useState("dashboard");

  const [token, setToken] = useState(
    localStorage.getItem("unfazedToken") || ""
  );

  const [therapist, setTherapist] = useState(
    localStorage.getItem("unfazedName") || ""
  );

  const [apiStatus, setApiStatus] = useState("Checking...");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPage, setAuthPage] = useState("login");

  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [selectedClient, setSelectedClient] = useState("");

  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState(fallbackPlans);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [selectingPlan, setSelectingPlan] = useState("");

  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    specializations: "",
    languages: "English"
  });

  const [clientEditId, setClientEditId] = useState("");
  const [appointmentEditId, setAppointmentEditId] = useState("");

  const menu = [
    ["dashboard", "Overview", "⌂"],
    ["clients", "Clients", "♙"],
    ["schedule", "Appointments", "▦"],
    ["notes", "Clinical notes", "▤"],
    ["payments", "Payments", "₹"],
    ["chat", "Messages", "✉"],
    ["analytics", "Analytics", "↗"],
    ["subscription", "Subscription", "◇"],
    ["profile", "My profile", "◎"]
  ];

  useEffect(() => {
    fetch(`${API}/health`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => {
        setApiStatus(
          data.database === "Connected"
            ? "MongoDB Connected"
            : "Backend Online"
        );
      })
      .catch(() => setApiStatus("Disconnected"));
  }, []);

  useEffect(() => {
    if (token) {
      loadWorkspace();
    }
  }, [token]);

  useEffect(() => {
    if (token && page === "subscription") {
      loadSubscription();
    }
  }, [token, page]);

  async function loadSubscription() {
    setSubscriptionLoading(true);

    try {
      const [subscriptionResult, plansResult] = await Promise.all([
        apiRequest("/subscription"),
        apiRequest("/subscription/plans")
      ]);

      setSubscription(subscriptionResult.subscription || null);

      const receivedPlans = plansResult.plans;

      if (Array.isArray(receivedPlans) && receivedPlans.length > 0) {
        setPlans(receivedPlans.map(plan => ({
          ...plan,
          id: plan.id || plan.key || plan.name?.toLowerCase()
        })));
      } else if (
        receivedPlans &&
        typeof receivedPlans === "object"
      ) {
        setPlans(
          Object.entries(receivedPlans).map(([id, plan]) => ({
            ...plan,
            id
          }))
        );
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function selectSubscription(planId) {
    if (!planId) return;

    setSelectingPlan(planId);
    setMessage("");

    try {
      const result = await apiRequest("/subscription/select", {
        method: "POST",
        body: JSON.stringify({ plan: planId })
      });

      await loadSubscription();

      setMessage(
        result.message || `${planId} plan selected successfully!`
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSelectingPlan("");
    }
  }

  async function loadWorkspace() {
    // Do not make protected API requests without a saved login token.
    if (!localStorage.getItem("unfazedToken")) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // allSettled allows successful modules to load even if one endpoint
      // fails (for example, Payments returning 403 on the Free plan).
      const results = await Promise.allSettled([
        apiRequest("/clients"),
        apiRequest("/appointments"),
        apiRequest("/notes"),
        apiRequest("/payments"),
        apiRequest("/profile"),
        apiRequest("/analytics")
      ]);

      const [
        clientsResult,
        appointmentsResult,
        notesResult,
        paymentsResult,
        profileResult,
        analyticsResult
      ] = results;

      const failedRequests = [];

      // CLIENTS
      if (clientsResult.status === "fulfilled") {
        setClients(clientsResult.value.clients || []);
      } else {
        console.error("Clients loading failed:", clientsResult.reason);
        failedRequests.push("Clients");
      }

      // APPOINTMENTS
      if (appointmentsResult.status === "fulfilled") {
        setAppointments(appointmentsResult.value.appointments || []);
      } else {
        console.error("Appointments loading failed:", appointmentsResult.reason);
        failedRequests.push("Appointments");
      }

      // CLINICAL NOTES
      if (notesResult.status === "fulfilled") {
        setNotes(notesResult.value.notes || []);
      } else {
        console.error("Clinical notes loading failed:", notesResult.reason);
        failedRequests.push("Clinical notes");
      }

      // PAYMENTS may be unavailable on the Free plan.
      if (paymentsResult.status === "fulfilled") {
        setPayments(paymentsResult.value.payments || []);
      } else if (paymentsResult.reason?.status === 403) {
        setPayments([]);
      } else {
        console.error("Payments loading failed:", paymentsResult.reason);
        failedRequests.push("Payments");
      }

      // THERAPIST PROFILE
      if (profileResult.status === "fulfilled") {
        const p = profileResult.value.profile;

        if (p) {
          setProfile({
            name: p.name || "",
            bio: p.bio || "",
            specializations: p.specializations || "",
            languages: p.languages || "English"
          });

          setTherapist(p.name || "");
          localStorage.setItem("unfazedName", p.name || "");
        }
      } else {
        console.error("Profile loading failed:", profileResult.reason);
        failedRequests.push("Profile");
      }

      // ANALYTICS
      if (analyticsResult.status === "fulfilled") {
        setAnalytics(analyticsResult.value.analytics || {});
      } else {
        console.error("Analytics loading failed:", analyticsResult.reason);
        failedRequests.push("Analytics");
      }

      // Load subscription separately; this function handles its own errors.
      await loadSubscription();

      if (failedRequests.length > 0) {
        setMessage(
          `Unable to load: ${failedRequests.join(", ")}. Check the browser console and backend.`
        );
      } else {
        setMessage("");
      }
    } catch (error) {
      console.error("Workspace loading error:", error);
      setMessage(error.message || "Unable to load your workspace.");
    } finally {
      setLoading(false);
    }
  }

  async function authenticate(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("Please wait...");

    try {
      const action = authPage === "login" ? "login" : "register";

      const response = await fetch(`${API}/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          email,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      if (!data.token) {
        throw new Error("Authentication response did not contain a token");
      }

      const name = data.therapist?.name || authName || "Therapist";

      localStorage.setItem("unfazedToken", data.token);
      localStorage.setItem("unfazedName", name);

      setToken(data.token);
      setTherapist(name);
      setProfile(old => ({ ...old, name }));
      setPage("dashboard");
      setMessage("Successfully logged in!");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("unfazedToken");
    localStorage.removeItem("unfazedName");

    setToken("");
    setTherapist("");
    setClients([]);
    setAppointments([]);
    setNotes([]);
    setPayments([]);
    setMessages([]);
    setSubscription(null);
    setSelectedClient("");
    setAuthPage("login");
    setMessage("Logged out successfully.");
  }

  // CLIENTS

  async function saveClient(event) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const body = {
      name: form.get("name"),
      email: form.get("email")
    };

    try {
      if (clientEditId) {
        const result = await apiRequest(`/clients/${clientEditId}`, {
          method: "PUT",
          body: JSON.stringify(body)
        });

        setClients(old =>
          old.map(c => c._id === clientEditId ? result.client : c)
        );

        setClientEditId("");
        setMessage("Client updated successfully!");
      } else {
        const result = await apiRequest("/clients", {
          method: "POST",
          body: JSON.stringify(body)
        });

        setClients(old => [result.client, ...old]);
        setMessage("Client saved to MongoDB!");
      }

      formElement.reset();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteClient(id) {
    if (!window.confirm("Delete this client?")) return;

    try {
      await apiRequest(`/clients/${id}`, { method: "DELETE" });

      setClients(old => old.filter(c => c._id !== id));
      setMessage("Client deleted.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  // APPOINTMENTS

  async function saveAppointment(event) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const body = {
      clientId: form.get("clientId"),
      date: form.get("date"),
      time: form.get("time"),
      title: form.get("title") || "Therapy session"
    };

    try {
      if (appointmentEditId) {
        const result = await apiRequest(
          `/appointments/${appointmentEditId}`,
          {
            method: "PUT",
            body: JSON.stringify(body)
          }
        );

        setAppointments(old =>
          old.map(a => a._id === appointmentEditId
            ? result.appointment : a)
        );

        setAppointmentEditId("");
        setMessage("Appointment updated!");
      } else {
        const result = await apiRequest("/appointments", {
          method: "POST",
          body: JSON.stringify(body)
        });

        setAppointments(old => [...old, result.appointment]);
        setMessage("Appointment saved to MongoDB!");
      }

      formElement.reset();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function cancelAppointment(id) {
    if (!window.confirm("Cancel this appointment?")) return;

    try {
      const result = await apiRequest(`/appointments/${id}`, {
        method: "DELETE"
      });

      setAppointments(old =>
        old.map(a => a._id === id ? result.appointment : a)
      );

      setMessage("Appointment cancelled.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  // CLINICAL NOTES

  async function saveNote(event) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const result = await apiRequest("/notes", {
        method: "POST",
        body: JSON.stringify({
          clientId: form.get("clientId"),
          title: form.get("title"),
          text: form.get("text"),
          visibility: form.get("visibility")
        })
      });

      setNotes(old => [result.note, ...old]);
      formElement.reset();
      setMessage("Clinical note saved!");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteNote(id) {
    if (!window.confirm("Delete this note?")) return;

    try {
      await apiRequest(`/notes/${id}`, { method: "DELETE" });

      setNotes(old => old.filter(n => n._id !== id));
      setMessage("Note deleted.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  // PAYMENTS

  async function loadRazorpay() {
    if (window.Razorpay) return true;

    return new Promise(resolve => {
      const script = document.createElement("script");

      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  }

  async function createPayment(event) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const clientId = form.get("clientId");
      const amount = Number(form.get("amount"));

      const result = await apiRequest("/payments/order", {
        method: "POST",
        body: JSON.stringify({ clientId, amount })
      });

      const loaded = await loadRazorpay();

      if (!loaded) {
        throw new Error("Unable to load Razorpay Checkout.");
      }

      const checkout = new window.Razorpay({
        key: result.keyId,
        order_id: result.order.id,
        amount: result.order.amount,
        currency: result.order.currency,
        name: "Unfazed",
        description: "Therapy session payment",

        handler: async function (response) {
          try {
            await apiRequest("/payments/verify", {
              method: "POST",
              body: JSON.stringify(response)
            });

            setMessage("Payment verified successfully!");

            const data = await apiRequest("/payments");
            setPayments(data.payments || []);

            const stats = await apiRequest("/analytics");
            setAnalytics(stats.analytics || {});
          } catch (error) {
            setMessage(error.message);
          }
        },

        modal: {
          ondismiss: () => setMessage("Checkout closed.")
        },

        theme: { color: "#587D70" }
      });

      checkout.on("payment.failed", function () {
        setMessage("Payment failed. Please check the test checkout.");
      });

      checkout.open();
    } catch (error) {
      setMessage(error.message);
    }
  }

  // MESSAGES

  async function loadMessages(clientId) {
    if (!clientId) return;

    try {
      const result = await apiRequest(`/messages/${clientId}`);
      setMessages(result.messages || []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = form.get("body");

    try {
      const result = await apiRequest("/messages", {
        method: "POST",
        body: JSON.stringify({
          clientId: selectedClient,
          body
        })
      });

      setMessages(old => [...old, result.message]);
      formElement.reset();
      setMessage("Message saved!");
    } catch (error) {
      setMessage(error.message);
    }
  }

  // PROFILE

  async function saveProfile(event) {
    event.preventDefault();

    try {
      const result = await apiRequest("/profile", {
        method: "PUT",
        body: JSON.stringify(profile)
      });

      const saved = result.profile;

      setProfile({
        name: saved.name || "",
        bio: saved.bio || "",
        specializations: saved.specializations || "",
        languages: saved.languages || ""
      });

      setTherapist(saved.name || "");
      localStorage.setItem("unfazedName", saved.name || "");

      setMessage("Profile saved successfully!");
    } catch (error) {
      setMessage(error.message);
    }
  }

  // AUTH SCREEN

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark">u.</div>
          <p className="eyebrow">YOUR PRACTICE, IN HARMONY</p>

          <h1>
            {authPage === "login"
              ? "Welcome back"
              : "Start your practice"}
          </h1>

          <p className="muted">
            A calmer way to manage your therapy practice.
          </p>

          <form onSubmit={authenticate}>
            {authPage === "register" && (
              <label>
                Full name
                <input
                  required
                  value={authName}
                  onChange={e => setAuthName(e.target.value)}
                  placeholder="Dr. Your Name"
                />
              </label>
            )}

            <label>
              Email address
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <input
                required
                type="password"
                minLength="8"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>

            <button className="primary full" disabled={loading}>
              {loading
                ? "Please wait..."
                : authPage === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="message">{message}</p>

          <button
            className="text-button"
            onClick={() => {
              setAuthPage(authPage === "login" ? "register" : "login");
              setMessage("");
            }}
          >
            {authPage === "login"
              ? "New to Unfazed? Create an account"
              : "Already registered? Sign in"}
          </button>
        </section>
      </main>
    );
  }

  // MAIN DASHBOARD

  return (
    <div className="app-shell">

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">u.</span>
          <span>
            unfazed<span className="brand-dot">.</span>
            <small>THERAPIST WORKSPACE</small>
          </span>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav>
          {menu.map(([id, label, icon]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "selected" : ""}`}
              onClick={() => {
                setPage(id);
                setMessage("");
              }}
            >
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          API: {apiStatus}

          <button className="nav-item" onClick={logout}>
            ↪ Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">

        <header className="topbar">
          <div>
            <p className="eyebrow">THERAPIST WORKSPACE</p>
            <h2>{menu.find(item => item[0] === page)?.[1]}</h2>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="avatar"
              title="Open my profile"
              onClick={() => {
                setPage("profile");
                setMessage("");
              }}
            >
              {(therapist || "T").charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        {message && <p className="notice">{message}</p>}
        {loading && <p className="muted">Loading your workspace...</p>}

        {/* DASHBOARD */}

        {page === "dashboard" && (
          <>
            <section className="welcome-panel">
              <div>
                <p className="eyebrow">A LITTLE SPACE FOR WHAT MATTERS</p>

                <h1>
                  {therapist
                    ? `Welcome, ${therapist}`
                    : "Welcome to your calmer workspace."}
                </h1>

                <p>Care for your clients. We'll help with the details.</p>

                <button
                  className="primary"
                  onClick={() => setPage("schedule")}
                >
                  + Plan a session
                </button>
              </div>

              <div className="welcome-art">✳</div>
            </section>

            <section className="stats-grid">
              <Stat
                title="Total clients"
                value={analytics.totalClients ?? clients.length}
                icon="♙"
              />

              <Stat
                title="Appointments"
                value={analytics.totalAppointments ?? appointments.length}
                icon="▦"
              />

              <Stat
                title="Clinical notes"
                value={analytics.totalNotes ?? notes.length}
                icon="▤"
              />

              <Stat
                title="Revenue"
                value={`₹${analytics.paidAmount ?? 0}`}
                icon="₹"
              />
            </section>

            <section className="content-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">YOUR DAY, AT A GLANCE</p>
                  <h3>Upcoming appointments</h3>
                </div>

                <button
                  className="secondary"
                  onClick={() => setPage("schedule")}
                >
                  View schedule →
                </button>
              </div>

              {appointments.filter(a => a.status === "Scheduled").length === 0
                ? <Empty text="No upcoming appointments." />
                : appointments
                    .filter(a => a.status === "Scheduled")
                    .slice(0, 5)
                    .map(a => (
                      <div className="list-row" key={a._id}>
                        <div className="mini-avatar">♙</div>

                        <div className="row-grow">
                          <strong>{a.client?.name || "Client"}</strong>
                          <p>{a.date} · {a.time}</p>
                        </div>

                        <span className="pill">{a.status}</span>
                      </div>
                    ))}
            </section>
          </>
        )}

        {/* CLIENTS */}

        {page === "clients" && (
          <section className="content-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CLIENT MANAGEMENT</p>
                <h3>Your clients</h3>
              </div>
            </div>

            <form className="inline-form" onSubmit={saveClient}>
              <input
                name="name"
                placeholder="Client name"
                required
                defaultValue={
                  clients.find(c => c._id === clientEditId)?.name || ""
                }
                key={clientEditId || "new-client-name"}
              />

              <input
                name="email"
                type="email"
                placeholder="Client email"
                required
                defaultValue={
                  clients.find(c => c._id === clientEditId)?.email || ""
                }
                key={clientEditId || "new-client-email"}
              />

              <button className="primary">
                {clientEditId ? "Update client" : "Add client"}
              </button>

              {clientEditId && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setClientEditId("")}
                >
                  Cancel
                </button>
              )}
            </form>

            {clients.length === 0
              ? <Empty text="No clients yet. Add a client above." />
              : clients.map(c => (
                  <div className="list-row" key={c._id}>
                    <div className="mini-avatar">
                      {c.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="row-grow">
                      <strong>{c.name}</strong>
                      <p>{c.email}</p>
                    </div>

                    <span className="pill">{c.status}</span>

                    <button
                      className="secondary"
                      onClick={() => {
                        setClientEditId(c._id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className="secondary"
                      onClick={() => deleteClient(c._id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
          </section>
        )}

        {/* APPOINTMENTS */}

        {page === "schedule" && (
          <section className="content-card">
            <p className="eyebrow">SCHEDULING</p>

            <h3>
              {appointmentEditId
                ? "Edit appointment"
                : "Plan an appointment"}
            </h3>

            {clients.length === 0 ? (
              <Empty text="Add a client before scheduling an appointment." />
            ) : (
              <form className="stack-form" onSubmit={saveAppointment}>
                <label>
                  Select client

                  <select
                    name="clientId"
                    required
                    defaultValue={
                      appointments.find(a => a._id === appointmentEditId)
                        ?.client?._id || ""
                    }
                  >
                    <option value="">Choose a client</option>

                    {clients.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Date

                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={
                      appointments.find(a => a._id === appointmentEditId)
                        ?.date || ""
                    }
                  />
                </label>

                <label>
                  Time

                  <input
                    name="time"
                    type="time"
                    required
                    defaultValue={
                      appointments.find(a => a._id === appointmentEditId)
                        ?.time || ""
                    }
                  />
                </label>

                <label>
                  Session title

                  <input
                    name="title"
                    defaultValue={
                      appointments.find(a => a._id === appointmentEditId)
                        ?.title || "Therapy session"
                    }
                  />
                </label>

                <button className="primary">
                  {appointmentEditId
                    ? "Update appointment"
                    : "Save appointment"}
                </button>

                {appointmentEditId && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setAppointmentEditId("")}
                  >
                    Cancel editing
                  </button>
                )}
              </form>
            )}

            <h3 className="subheading">Scheduled appointments</h3>

            {appointments.map(a => (
              <div className="list-row" key={a._id}>
                <div className="mini-avatar">▦</div>

                <div className="row-grow">
                  <strong>{a.client?.name || "Client"}</strong>
                  <p>{a.date} · {a.time} · {a.title}</p>
                  <span className="pill">{a.status}</span>
                </div>

                {a.status === "Scheduled" && (
                  <>
                    <button
                      className="secondary"
                      onClick={() => {
                        setAppointmentEditId(a._id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className="secondary"
                      onClick={() => cancelAppointment(a._id)}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            ))}
          </section>
        )}

        {/* NOTES */}

        {page === "notes" && (
          <section className="content-card">
            <p className="eyebrow">CLINICAL DOCUMENTATION</p>
            <h3>Session notes</h3>

            <p className="muted">
              Development demo: use fictional sample information only.
            </p>

            {clients.length === 0 ? (
              <Empty text="Add a client before creating a note." />
            ) : (
              <form className="stack-form" onSubmit={saveNote}>
                <label>
                  Client

                  <select name="clientId" required>
                    <option value="">Choose a client</option>

                    {clients.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Note title
                  <input name="title" required placeholder="Session summary" />
                </label>

                <label>
                  Visibility

                  <select name="visibility">
                    <option value="private">Private to therapist</option>
                    <option value="shared">Shared with client</option>
                  </select>
                </label>

                <label>
                  Note content

                  <textarea
                    name="text"
                    required
                    rows="5"
                    placeholder="Enter fictional sample note..."
                  />
                </label>

                <button className="primary">Save note</button>
              </form>
            )}

            <h3 className="subheading">Saved notes</h3>

            {notes.map(n => (
              <div className="list-row" key={n._id}>
                <div className="row-grow">
                  <strong>{n.title}</strong>
                  <p>{n.client?.name || "Client"} · {n.visibility}</p>
                </div>

                <button
                  className="secondary"
                  onClick={() => deleteNote(n._id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </section>
        )}

        {/* PAYMENTS */}

{page === "payments" && (
  <section className="content-card">
    {subscription?.plan?.toLowerCase() === "free" ? (
      <div className="upgrade-card">
        <p className="eyebrow">PLAN RESTRICTION</p>

        <div style={{ textAlign: "center", padding: "35px 15px" }}>
          <div style={{ fontSize: "45px" }}>🔒</div>

          <h2>Payments is Locked</h2>

          <p className="muted">
            Your current Free plan does not include payment management.
            Upgrade your subscription to unlock Razorpay payments.
          </p>

          <button
            className="primary"
            onClick={() => setPage("subscription")}
          >
            Upgrade Your Plan
          </button>
        </div>
      </div>
    ) : (
      <>
        <p className="eyebrow">BILLING</p>
        <h3>Payments</h3>

        <p className="muted">
          Razorpay test mode. Use only test credentials and test payment methods.
        </p>

        {clients.length === 0 ? (
          <Empty text="Add a client before creating a payment." />
        ) : (
          <form className="stack-form" onSubmit={createPayment}>
            <label>
              Select client

              <select name="clientId" required>
                <option value="">Choose a client</option>

                {clients.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Amount (INR)

              <input
                name="amount"
                type="number"
                min="1"
                max="1000000"
                required
                placeholder="500"
              />
            </label>

            <button className="primary">
              Pay with Razorpay
            </button>
          </form>
        )}

        <h3 className="subheading">Payment history</h3>

        {payments.length === 0
          ? <Empty text="No payments yet." />
          : payments.map(p => (
              <div className="list-row" key={p._id}>
                <div className="row-grow">
                  <strong>{p.client?.name || "Client"}</strong>
                  <p>₹{p.amount} · {p.status}</p>
                </div>

                <span className="pill">{p.status}</span>
              </div>
            ))}
      </>
    )}
  </section>
)}

        {/* MESSAGES */}

        {page === "chat" && (
          <section className="content-card">
            <p className="eyebrow">COMMUNICATION</p>
            <h3>Messages</h3>

            <label>
              Select client

              <select
                value={selectedClient}
                onChange={e => {
                  setSelectedClient(e.target.value);
                  setMessages([]);
                  loadMessages(e.target.value);
                }}
              >
                <option value="">Choose a client</option>

                {clients.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedClient && (
              <>
                <div className="message-list">
                  {messages.length === 0 ? (
                    <Empty text="No messages in this conversation." />
                  ) : messages.map(m => (
                    <div className="list-row" key={m._id}>
                      <div className="row-grow">
                        <strong>
                          {m.sender === "therapist" ? "You" : "Client"}
                        </strong>

                        <p>{m.body}</p>

                        <small>
                          {new Date(m.createdAt).toLocaleString()}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>

                <form className="inline-form" onSubmit={sendMessage}>
                  <input
                    name="body"
                    required
                    maxLength="3000"
                    placeholder="Write a message..."
                  />

                  <button className="primary">Send</button>
                </form>
              </>
            )}

            <p className="muted">
              This demo supports therapist-side message storage. Client login
              and client-side messaging access still need to be implemented.
            </p>
          </section>
        )}

        {/* ANALYTICS */}

        {page === "analytics" && (
          <section className="content-card">
            <p className="eyebrow">PRACTICE INSIGHTS</p>
            <h3>Analytics dashboard</h3>

            <section className="stats-grid">
              <Stat
                title="Total clients"
                value={analytics.totalClients ?? 0}
                icon="♙"
              />

              <Stat
                title="Appointments"
                value={analytics.totalAppointments ?? 0}
                icon="▦"
              />

              <Stat
                title="Clinical notes"
                value={analytics.totalNotes ?? 0}
                icon="▤"
              />

              <Stat
                title="Revenue"
                value={`₹${analytics.paidAmount ?? 0}`}
                icon="₹"
              />

              <Stat
                title="Paid transactions"
                value={analytics.paidTransactions ?? 0}
                icon="✓"
              />
            </section>

            <h3 className="subheading">Upcoming sessions</h3>

            {(analytics.upcomingAppointments || []).length === 0
              ? <Empty text="No upcoming sessions." />
              : analytics.upcomingAppointments.map(a => (
                  <div className="list-row" key={a._id}>
                    <div className="row-grow">
                      <strong>{a.client?.name || "Client"}</strong>
                      <p>{a.date} · {a.time}</p>
                    </div>
                  </div>
                ))}
          </section>
        )}

        {/* SUBSCRIPTION */}

        {page === "subscription" && (
          <section>
            <section className="content-card">
              <p className="eyebrow">YOUR UNFAZED MEMBERSHIP</p>
              <h3>Subscription overview</h3>

              {subscriptionLoading ? (
                <p className="muted">Loading subscription details...</p>
              ) : (
                <>
                  <div className="profile-preview">
                    <p className="eyebrow">CURRENT PLAN</p>

                    <h2>
                      {(subscription?.plan || "free")
                        .charAt(0)
                        .toUpperCase() +
                        (subscription?.plan || "free").slice(1)}
                    </h2>

                    <span className="pill">
                      {subscription?.status || "Active"}
                    </span>

                    <p className="muted">
                      Your selected plan is saved with your therapist account.
                    </p>
                  </div>

                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">SIMPLE, FLEXIBLE OPTIONS</p>
                      <h3>Choose your plan</h3>
                    </div>
                  </div>

                  <div className="stats-grid">
                    {plans.map(plan => {
                      const currentPlan =
                        (subscription?.plan || "free").toLowerCase();

                      const planId = (
                        plan.id ||
                        plan.key ||
                        plan.name?.toLowerCase()
                      );

                      const isCurrent = currentPlan === planId;

                      return (
                        <div className="stat-card" key={planId}>
                          <p className="eyebrow">{plan.name || planId}</p>

                          <h2>
                            ₹{plan.price ?? 0}
                            <small className="muted"> / month</small>
                          </h2>

                          <p>{plan.description || "Subscription plan"}</p>

                          <div className="plan-features">
  {(Array.isArray(plan.features)
    ? plan.features
    : plan.features && typeof plan.features === "object"
      ? Object.entries(plan.features)
          .filter(([key, value]) => value === true)
          .map(([key]) => key)
      : []
  ).map((feature, index) => (
    <p key={index}>
      ✓ {typeof feature === "string"
        ? feature
        : feature.name || feature.label || "Feature"}
    </p>
  ))}
</div>

                          <button
                            className={isCurrent ? "secondary" : "primary"}
                            disabled={isCurrent || selectingPlan !== ""}
                            onClick={() => selectSubscription(planId)}
                          >
                            {selectingPlan === planId
                              ? "Please wait..."
                              : isCurrent
                                ? "Current plan"
                                : "Select plan"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <p className="muted">
                    Demo mode: selecting a plan updates your subscription
                    in the database. It does not charge money or start
                    recurring billing through Razorpay.
                  </p>
                </>
              )}

              <button
                className="secondary"
                onClick={loadSubscription}
                disabled={subscriptionLoading}
              >
                Refresh subscription
              </button>
            </section>
          </section>
        )}

        {/* PROFILE */}

        {page === "profile" && (
          <section className="content-card">
            <p className="eyebrow">YOUR PUBLIC PRESENCE</p>
            <h3>Therapist profile</h3>

            <form className="stack-form" onSubmit={saveProfile}>
              <label>
                Display name

                <input
                  required
                  value={profile.name}
                  onChange={e =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                />
              </label>

              <label>
                About you

                <textarea
                  rows="4"
                  value={profile.bio}
                  onChange={e =>
                    setProfile({ ...profile, bio: e.target.value })
                  }
                />
              </label>

              <label>
                Specializations

                <input
                  value={profile.specializations}
                  onChange={e =>
                    setProfile({
                      ...profile,
                      specializations: e.target.value
                    })
                  }
                  placeholder="Stress, relationships..."
                />
              </label>

              <label>
                Languages

                <input
                  value={profile.languages}
                  onChange={e =>
                    setProfile({ ...profile, languages: e.target.value })
                  }
                />
              </label>

              <button className="primary">Save profile</button>
            </form>

            <div className="profile-preview">
              <h3>{profile.name || "Your name"}</h3>
              <p>{profile.bio || "Your introduction will appear here."}</p>
              <p>{profile.specializations}</p>
              <span className="pill">{profile.languages}</span>
            </div>
          </section>
        )}

        <footer>Unfazed · A thoughtful space for better care.</footer>
      </main>
    </div>
  );
}

function Stat({ title, value, icon }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="empty-state">
      <span>✳</span>
      <p>{text}</p>
    </div>
  );
}

export default App;
