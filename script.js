
function updatePrices() {
  fetch('predict.json')
    .then(response => response.json())
    .then(data => {
      const gold = data.gold;
      const plat = data.platinum;

      const goldDiffClass = gold.diff > 0 ? 'up' : (gold.diff < 0 ? 'down' : '');
      const platDiffClass = plat.diff > 0 ? 'up' : (plat.diff < 0 ? 'down' : '');

      document.getElementById('gold-price').innerHTML =
        `金価格: ${gold.price}円 <span class="${goldDiffClass}">(${gold.diff >= 0 ? '+' : ''}${gold.diff}円)</span>`;
      document.getElementById('platinum-price').innerHTML =
        `プラチナ価格: ${plat.price}円 <span class="${platDiffClass}">(${plat.diff >= 0 ? '+' : ''}${plat.diff}円)</span>`;
    });
}
updatePrices();
setInterval(updatePrices, 5 * 60 * 1000); // 5分ごとに更新
