const url = process.argv[2];
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch(url);
    if (response.ok) process.exit(0);
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
throw new Error(`Timed out waiting for ${url}`);
