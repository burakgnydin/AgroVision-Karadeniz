# 🌱 AgroVision Karadeniz

AgroVision Karadeniz, Doğu Karadeniz bölgesindeki tarımsal verimliliği artırmak amacıyla geliştirilmiş, yapay zeka destekli bir bitki sağlığı analiz platformudur[cite: 1]. Sistem, Google Gemini 1.5 Pro modelini kullanarak fındık ve çay gibi bölgeye özgü ürünlerdeki hastalıkları görüntü işleme yoluyla teşhis eder[cite: 1].

## 🔗 Canlı Demo
[https://agrovision-karadeniz-48380426745.europe-west1.run.app/](https://agrovision-karadeniz-48380426745.europe-west1.run.app/)

## 🚀 Temel Yetenekler
* **AI Görüntü Analizi:** Gemini Vision API kullanarak yaprak fotoğraflarından hastalık teşhisi, risk seviyesi belirleme ve tedavi önerisi sunma[cite: 1].
* **Dinamik Hava Durumu Entegrasyonu:** Open-Meteo API aracılığıyla anlık sıcaklık ve nem verilerini takip ederek mantar hastalıkları için otomatik risk uyarısı oluşturma[cite: 1].
* **Bilgi Bankası:** Bölgeye özgü yaygın hastalıklar (Külleme, Fındık Kurdu, Kırmızı Örümcek vb.) için belirti ve mücadele yöntemlerini içeren kütüphane[cite: 1].
* **Topluluk Forumu:** Firestore tabanlı, kullanıcıların gerçek zamanlı yardımlaşabildiği tartışma platformu[cite: 1].
* **Analiz Arşivi:** Firebase Auth ile kullanıcı girişli tarama geçmişi saklama ve veri takibi[cite: 1].

## 🛠️ Teknik Mimari
* **Frontend:** React, Vite, Tailwind CSS, Framer Motion[cite: 1].
* **AI Engine:** Google Generative AI SDK (Gemini 1.5 Pro)[cite: 1].
* **Backend & Data:** Firebase (Authentication, Firestore, Hosting)[cite: 1].
* **Konum & Hava Durumu:** Nominatim Reverse Geocoding, Open-Meteo API[cite: 1].
* **Altyapı:** Google Cloud Run (Dockerized deployment)[cite: 1].
