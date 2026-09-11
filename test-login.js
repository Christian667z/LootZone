const res = await fetch('http://localhost:3000/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@lootzone.gg', password: 'password' }) // Wait, I don't know the password
});
console.log(await res.text());
