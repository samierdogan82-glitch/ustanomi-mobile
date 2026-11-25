# Ustanomi marka sistemi

Tek geometri kaynağı: [scripts/build-brand.mjs](file:///c:/Users/V%C4%B0CTUS/Desktop/projeler/ustanomi-mobile/scripts/build-brand.mjs). Bütün ikonlar, favicon, mağaza görselleri ve açılış ekranları buradan türetilir, platformlar arasında kayma olmaz.

## Konsept
"U" harfi at nalı tabanlı bir kap gibi çizildi (usta, el işi). Kabın içindeki tek altın madeni para ekonomiyi, yani güvenli ödeme havuzunu anlatır. Yazı, degrade ve parlama yok; 16 px favicon'dan 1024 px mağaza ikonuna kadar okunur.

## Geometri (1024 birimlik ızgara)
| Öğe | Değer |
| :--- | :--- |
| U yolu | `M360 262V542A152 152 0 0 0 664 542V262` |
| U kalınlığı | 136 |
| Kol aralığı | 304 (iç boşluk 168) |
| Alt yarıçap | 152 |
| Para | merkez (512, 488), yarıçap 60 |
| Uç kesimi | düz (butt), el yapımı sert kenar |

## Renkler
| Rol | Hex |
| :--- | :--- |
| Mürekkep (zemin) | `#0E1726` |
| Beyaz (U) | `#FFFFFF` |
| Altın (para) | `#FFB400` |
| Koyu varyant (açık zeminde U) | `#262626` |

## Güvenli alanlar
- Android adaptive: işaret yaklaşık %44 genişlik, %67'lik güvenli dairenin içinde.
- Maskable PWA: en uzak köşe merkezden 333 birim, güvenli yarıçap 410.
- Mağaza ikonları alfa kanalsız (iki mağaza da böyle ister).

## Kullanılan depolar
| Depo | Lisans | Ne için |
| :--- | :--- | :--- |
| `sharp` | Apache-2.0 | SVG'den PNG üretimi |
| `@capacitor/assets` | MIT | Android/iOS ikon ve açılış ekranı dağıtımı |

## Yeniden üretme
```
npm run brand:build     # ana dosyalar + Android/iOS ikon ve açılış ekranları
npm run brand:preview   # kontrol tablosu
```
