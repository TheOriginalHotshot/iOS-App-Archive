
fetch('ipa-data.json')
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById('appContainer');
        const searchInput = document.getElementById('searchInput');

        function renderApps(apps) {
            container.innerHTML = '';
            apps.forEach(app => {
                const card = document.createElement('div');
                card.className = 'app-card';
                card.innerHTML = `
                    <img src="\${app.icon}" alt="\${app.name} Icon">
                    <h2>\${app.name}</h2>
                    <p>\${app.description}</p>
                    <a href="\${app.link}" target="_blank">Download</a>
                `;
                container.appendChild(card);
            });
        }

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filtered = data.filter(app => app.name.toLowerCase().includes(query));
            renderApps(filtered);
        });

        renderApps(data);
    });
