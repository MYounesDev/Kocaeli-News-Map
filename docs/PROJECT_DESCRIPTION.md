# Kocaeli Yerel Haber Haritası Projesi

## 1. PROJE TANIMI

Günümüzde şehir yaşamı, trafik kazaları, elektrik kesintileri, hava durumu uyarıları, toplumsal etkinlikler ve çeşitli acil durumlar gibi birçok dinamik olaydan etkilenmektedir. Bu olaylar genellikle haber siteleri, belediye duyuruları ve dijital medya platformları aracılığıyla kamuoyuna duyurulmaktadır. Ancak bu bilgilerin farklı kaynaklarda dağınık halde bulunması, kullanıcıların güncel olaylara bütüncül ve hızlı şekilde erişmesini zorlaştırmaktadır.

Bu proje kapsamında, Kocaeli yerel haber sitelerinden belirlenen haber türlerine ait haberlerin web ortamından otomatik olarak toplanmasını, işlenmesini ve Google Maps üzerinde görselleştirilmesini sağlayan bir sistemin geliştirilmesi amaçlanmaktadır. Sistem, web scraping teknikleri kullanılarak belirlenen haber kaynaklarından veri toplayacak ve NoSQL veritabanında saklayacaktır. Elde edilen olay verileri, web tabanlı bir arayüz üzerinde harita kullanılarak kullanıcıya sunulacaktır.

### Kullanılabilir Teknolojiler ve Programlama Dilleri

- Backend: Python FastApi
- Frontend: Next.js
- **Veritabanı olarak MongoDB kullanımı zorunludur.** MongoDB kullanılmayan projelerin değerlendirme puanı %50 oranında düşürülecektir.

## 2. HABER TÜRLERİ

Sistem yalnızca Kocaeli ili sınırları içerisindeki yerel haberleri kapsamalıdır. Ulusal haber siteleri kullanılmamalıdır. Aşağıda projede bulunması zorunlu haber türleri verilmiştir. Burada her haber yalnızca bir haber türü ile etiketlenmelidir. Haber türü veritabanında ayrı bir alan olarak saklanmalıdır.

### Haber Türleri

- guncel
- polis
- siyaset
- egitim
- ekonomi
- yasam
- saglik
- teknoloji
- spor
- it can be so many other things (in the /arsiv page also the h3 with the class "f-cat f-item" inside the "f-cat f-item" named div is also an accesspted news type)
## 3. WEB SCRAPING MODÜLÜ

Sistem aşağıdaki verilen Kocaeli yerel haber kaynaklarından, zorunlu haber türüne göre son 3 günlük (Defult zamanlama, kullancı isterse başka süre ayarlıyabilir) zaman dilimine göre veri çekmelidir. Veri çekme işlemi otomatik olmalıdır. Ayrıca arayüzde belirli bir zaman dilimine ait haberleri çekme botunu (kullancı tıkladığında belirlenen süreye göre tekrar haber çekecek) veya filtreleme bölümü yer almalıdır.

### Haber Kaynakları

- https://www.cagdaskocaeli.com.tr/ :
    
    https://www.cagdaskocaeli.com.tr/arsiv/{Date} bu sayfa birilenen tarihe göre haberleri listelemektedir. (örnek: https://www.cagdaskocaeli.com.tr/arsiv/2026-04-01 2026-04-01 tarihindeki haberleri listeler)

    html kodunda "f-cat f-item" class isimli divlerin bulup onlardan her birinin içinde h3 tagın bu divdeki haberlerin türünü söylüyor
    altındaki <ul> içindeki <li> etiketinin içindeki a etiketlerinin href özelliğini alarak haber linklerini elde edebilirsiniz ve <time> tagı haberin yayın saatini veriyor.
    örnek:
    https://www.cagdaskocaeli.com.tr/arsiv/2026-04-01 sayfasından alınmıştır.
    ```html
      <div class="f-cat f-item">
          <h3 class="f-brandon-black">Ekonomi</h3>
          <ul class="list underline">
              <li>
                  <time>21:46</time><a href="/haber/27734869/degirmenderede-kaybolan-iki-ogrenci-bulundu" class="lb  "
                      target="_blank">Değirmendere’de kaybolan iki öğrenci bulundu </a>
              </li>
              <li>
                  <time>21:26</time><a href="/haber/27734813/degirmenderede-10-yasindaki-zumra-ve-ravzadan-haber-alinamiyor"
                      class="lb  " target="_blank">Değirmendere’de 10 yaşındaki Zümra ve Ravza’dan haber alınamıyor </a>
              </li>
          </ul>
      </div>
    ```
    bu bize haberlerin türünü, haber linkini ve haberin yayın saatini veriyor (tarihi zaten linkten biliyoruz). haber linkini kullanarak haberin içeriğini çekebilirsiniz.


- https://www.ozgurkocaeli.com.tr/ : same logic as cagdaskocaeli.com.tr
- https://www.seskocaeli.com/ : same logic as cagdaskocaeli.com.tr
- https://www.bizimyaka.com/ : same logic as cagdaskocaeli.com.tr
- https://www.yenikocaeli.com/ : 
  haber türleri için ayrı ayrı sayfalarımız var. haber linklerini çekmek için:
    "https://www.yenikocaeli.com/haber/guncel/sayfa-1.html"
    "https://www.yenikocaeli.com/haber/polis-adliye/sayfa-1.html"
    "https://www.yenikocaeli.com/haber/siyaset/sayfa-1.html"
    "https://www.yenikocaeli.com/haber/egitim/sayfa-1.html"
    "https://www.yenikocaeli.com/haber/ekonomi/sayfa-1.html"
    "https://www.yenikocaeli.com/haber/yasam/sayfa-1.html"
    "https://www.yenikocaeli.com/haber/saglik/sayfa-1.html"
    "https://www.yenikocaeli.com/haber/teknoloji/sayfa-1.html"
    "https://www.yenikocaeli.com/haber/spor/sayfa-1.html"

  her sayfada her haberin divi "col-sm-12 col-md-6 col-lg-4" class isimli divlerin içinde bulunuyor, örnek:
  ```html
      <div class="col-sm-12 col-md-6 col-lg-4">
          <div class="post-item">
              <div class="post-body">
                  <h4 class="post-title">
                      <a href="haber/saglik/hekimsenden-mart-ayi-verilerine-iliskin-degerlendirme/193575.html"
                          class="d-inline-block">Hekimsen'den mart ayı verilerine ilişkin değerlendirme</a>
                  </h4>
                  <p class="post-text">
                      <a href="haber/saglik/hekimsenden-mart-ayi-verilerine-iliskin-degerlendirme/193575.html"
                          class="d-inline-block">Hekimsen, Mart 2026 dönemini kapsayan açlık ve yoksulluk sınırı araştırması neticelerini değerlendirdi.</a>
                  </p>
              </div>
          </div>
      </div>
        ```
    burda hem bir haberin başlığı ve içeriği aynı divin içinde bulunuyor (başlığı ve içeriği birleştirerek haberin yeni başlığı elde edilebilir) hem de haber linki aynı divin içinde bulunuyor. haber linkini kullanarak haberin tarihini bulabilirsiniz. @news_date.py dosyasından örnek bir haber linki için tarih bulma örneği bulabilirsiniz.
    böylece bu siteden her haberin tarihini kontrol ederek istenen zaman dilimine ait haberleri çekebilirsiniz. 

  
    

### Çekilen Her Haber için Gerekli Alanlar

- Haber türü
- Haber başlığı
- Haber içeriği
- Haberin konumu (Hem metin hem de enlem/boylam bilgisi olarak tutulmalıdır.)
- Yayın tarihi
- Haber sitesi adı
- Haber linki

### Duplicate Kontrol

- Aynı haber birden fazla kez kaydedilmemelidir. Her haber benzersiz kabul edilmeli ve duplicate (tekrar) kontrolü yapılmalıdır.
- Farklı haber kaynaklarında yer alan ancak içerik olarak aynı olan haberler tek bir haber olarak değerlendirilmelidir.
- Haberler arasında metin benzerliği analizi (embedding tabanlı benzerlik ölçümü ile) yapılmalıdır. **Benzerlik oranı %90 ve üzeri ise bu haberler aynı haber olarak kabul edilmelidir.**
- Aynı haber birden fazla haber kaynağında yer alıyorsa, harita üzerinde görselleştirirken haber kaynaklarının tümü listelenmelidir.
- Scraping işlemi sistem çalıştığında tekrar tetiklenebilir olmalıdır.

## 4. VERİ TEMİZLEME VE ÖN İŞLEME

Scraping sonrası elde edilen metinler işlenmeli ve analiz edilebilir hale getirilmelidir. Aşağıda ön işleme aşamasında yapılması beklenen zorunlu isterler belirtilmiştir.

- HTML tag temizliği yapılmalıdır.
- Fazla boşluklar temizlenmelidir.
- Gereksiz özel karakterler temizlenmelidir.
- Metin normalizasyonu yapılmalıdır.
- Reklam veya alakasız bölümler mümkün olduğunca çıkarılmalıdır.

## 5. HABER TÜRÜ SINIFLANDIRMA

Her haber içeriği analiz edilerek haber türü belirlenmelidir.

- En az anahtar kelime tabanlı sınıflandırma yapılmalıdır.
- Kullanılan anahtar kelimeler raporda listelenmelidir.
- Eğer haber birden fazla kategoriye giriyorsa, öncelik sırası tanımlanmalıdır.
- Sınıflandırma otomatik olmalıdır.
- Sınıflandırma sonucu veritabanında saklanmalıdır.

## 6. KONUM BİLGİSİ ÇIKARIMI

Haber metninden olayın gerçekleştiği yer bilgisi çıkarılmalıdır. Aşağıda konum tespit edilirken dikkat edilmesi gereken kurallar listelenmiştir.

- Haber içerisinde konum belirten metinlerin tümü tespit edilmelidir. Tespit edilen metinlere göre:
  - Eğer adres bilgisi net değilse, mümkün olan en spesifik konum bilgisi alınabilir (İzmit).
  - Eğer haber içeriğinde mahalle veya sokak adı verilmişse, harita üzerinde bu bilgilere göre görselleştirilmelidir.
- Tespit edilen konum bilgisi veritabanından görüntülenebilir olmalıdır. (Sunum esnasında tespit edilen konumları göstermeniz istenebilir.)
- Konum bulunamazsa, haber haritada gösterilmemelidir.
- Konum çıkarım yöntemi raporda detaylı bir şekilde açıklanmalıdır.

## 7. GEOCODING (KOORDİNAT DÖNÜŞTÜRME)

Haberlerin Google Maps üzerinde görüntülenebilmesi için haber metninden tespit edilen konumun uygun ve doğru koordinat bilgilerine dönüştürülmesi gerekmektedir. Koordinat bilgileri tespiti için aşağıda verilen kurallara dikkat edilmelidir.

- Bir geocoding servisi (Google Geocoding API gibi) kullanılmalıdır.
- API anahtarı güvenli biçimde saklanmalıdır.
- Dönüştürülen koordinatlar veritabanına kaydedilmelidir.
- Geocoding başarısız olursa kayıt işlenmemelidir.
- Aynı konum için gereksiz tekrar API çağrısı yapılmamalıdır.

## 8. GOOGLE MAPS ENTEGRASYONU

Haberler Google Maps üzerinde görselleştirilecektir. Görselleştirmede beklenen minimum kriteler aşağıda belirtilmiştir. Bu kriterleri sağlamak koşuluyla projenin zenginleştirilmesi öğrenciye bırakılmıştır.

- Haritanın başlangıç noktası Kocaeli merkez olmalıdır.
- Her haber için bir marker eklenmelidir.
- Haber türüne göre projenin başında verilen görselde olduğu gibi, marker rengi ve sembolü farklı olmalıdır.
- Marker'a tıklandığında bilgi penceresi açılmalıdır. Bilgi penceresinde aşağıdakiler bulunmalıdır:
  - Başlık
  - Tarih
  - Kaynak adı
  - Habere Git butonu
- Habere Git butonu ile haberin kaynak sitesi yeni sekmede görüntülenmelidir.
- Harita filtreleme işlemleri dinamik olarak çalışmalıdır.


## 9. KULLANICI ARAYÜZÜ GEREKSİNİMLERİ

Kullanıcı arayüzünde yer alması gereken minimum isterler aşağıdaki belirtilmiştir. Ayrıca projenin başında bir örnek arayüz görseli paylaşılmıştır. Bu görsel örnek olup, dilediğiniz şekilde projenizi ve arayüzünüzü kişiselleştirmeniz beklenmektedir.

- Haber türü, ilçe, tarih seçimi için filtre menüsü bulunmalıdır.
- Harita yeniden yüklenmeden filtre uygulanabilmelidir.
- Kullanıcı arayüzü sade ve anlaşılır olmalıdır.


