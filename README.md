# ABYSSBOUND ONLINE — Web Alpha v0.4

## Bu sürümde
- Solo prototype korunur.
- 4 kişiye kadar oda kurma / oda koduyla katılma.
- Oyuncu hareket ve saldırı efekt senkronu.
- **Online modda enemy HP, boss HP ve ölüm kararı sunucu otoritesindedir.**
- Sunucu cooldown, menzil, bakış açısı, crit ve hasarı hesaplar.
- Altı ortak kill sonrası The Mourner tüm oyuncular için aynı anda spawn olur.
- **Loot sunucuda üretilir ve tek oyuncu tarafından alınabilir.**
- Aynı odadaki tüm oyuncular aynı enemy/loot snapshot'ını görür.

## Çalıştırma
```bash
python3 server.py
```
Sonra `http://127.0.0.1:4173` adresini aç.

İki tarayıcı/sekme ile test:
1. İlkinde `ODA KUR`.
2. Oda kodunu ikinci sekmede `ODAYA KATIL` ile gir.
3. Aynı düşmana iki istemciden vur; HP/ölüm/loot her ikisinde ortak kalır.

## Kontroller
- WASD: hareket
- Mouse: yön
- Sol tık: temel saldırı
- 1: Blood Cleave
- 2: Chain of Torment
- 3: Blood Rush
- 4: Crimson Guard
- R: Bloodstorm
- Space: dodge
- I: inventory
