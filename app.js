const supabase = window.supabase.createClient(
  "YOUR_SUPABASE_URL",
  "YOUR_ANON_KEY"
);

// LOGIN
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({
    email, password
  });

  if (error) {
    alert(error.message);
    return;
  }

  checkRole();
}

// ROLE CHECK
async function checkRole() {
  const user = (await supabase.auth.getUser()).data.user;

  const { data } = await supabase
    .from("users_role")
    .select("role")
    .eq("email", user.email)
    .single();

  if (data.role === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "dashboard.html";
  }
}