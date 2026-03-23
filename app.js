const supabase = window.supabase.createClient(
  "https://domskxftgijzhsrvuxhj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbXNreGZ0Z2l6amhzcnZ1eGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzE4NjMsImV4cCI6MjA4OTgwNzg2M30.kb3ftTaSOPIdK8_6RLqTWPxfKYGNbmVqsI7_XQhP24w"
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
