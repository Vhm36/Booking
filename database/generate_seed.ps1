# Script tao du lieu seed lon cho BeautyBook
# 500 dich vu | 5 quan ly | 10 thu ngan | 20 nhan vien | 20,000 khach hang
# Du lieu lich hen tu 2024 den nay

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$outputFile = Join-Path $PSScriptRoot "seed_massive.sql"
$sw = [System.IO.StreamWriter]::new($outputFile, $false, [System.Text.Encoding]::UTF8)

# ===================== HO TEN VIET NAM =====================
$ho = @('Nguyen','Tran','Le','Pham','Hoang','Huynh','Phan','Vu','Vo','Dang','Bui','Do','Ho','Ngo','Duong','Ly','Dao','Dinh','Mai','Trinh','Luong','Ta','Cao','To','Chau','Tang','Quach','Ha','Thai','Nghiem')

$hoVN = @("Nguy" + [char]0x1EC5 + "n", "Tr" + [char]0x1EA7 + "n", "L" + [char]0x00EA, "Ph" + [char]0x1EA1 + "m", "Ho" + [char]0x00E0 + "ng", "Hu" + [char]0x1EF3 + "nh", "Phan", "V" + [char]0x0169, "V" + [char]0x00F5, [char]0x0110 + [char]0x1EB7 + "ng", "B" + [char]0x00F9 + "i", [char]0x0110 + [char]0x1ED7, "H" + [char]0x1ED3, "Ng" + [char]0x00F4, "D" + [char]0x01B0 + [char]0x01A1 + "ng", "L" + [char]0x00FD, [char]0x0110 + [char]0x00E0 + "o", [char]0x0110 + "inh", "Mai", "Tr" + [char]0x1ECB + "nh", "L" + [char]0x01B0 + [char]0x01A1 + "ng", "T" + [char]0x1EA1, "Cao", "T" + [char]0x00F4, "Ch" + [char]0x00E2 + "u", "T" + [char]0x0103 + "ng", "Qu" + [char]0x00E1 + "ch", "H" + [char]0x00E0, "Th" + [char]0x00E1 + "i", "Nghi" + [char]0x00EA + "m")

Write-Host "Using simplified Vietnamese names for maximum compatibility..."

# Simplified Vietnamese names (ASCII-safe base + id for uniqueness)
$hoSimple = @('Nguyen','Tran','Le','Pham','Hoang','Huynh','Phan','Vu','Vo','Dang','Bui','Do','Ho','Ngo','Duong','Ly','Dao','Dinh','Mai','Trinh','Luong','Ta','Cao','To','Chau','Tang','Quach','Ha','Thai','Nghiem')
$demNu = @('Thi','Ngoc','Thanh','Thu','Minh','Hoang','Phuong','Hong','Kim','Bich','Quynh','Dieu','Thuy','Tuong','My','Xuan','Khanh','Anh','Hai','Yen')
$demNam = @('Van','Huu','Duc','Cong','Quoc','Minh','Thanh','Tuan','Hung','Trung','Anh','Dinh','Xuan','Ba','Ngoc','Hoang','Trong','Phuc','Viet','Tien')
$tenNu = @('An','Anh','Binh','Chi','Chau','Diem','Dung','Duyen','Giang','Ha','Hanh','Hang','Hien','Hoa','Huong','Huyen','Khanh','Lan','Lien','Linh','Loan','Ly','Mai','My','Nga','Ngan','Ngoc','Nhi','Nhung','Nhu','Oanh','Phuong','Quyen','Tam','Thao','Thi','Thuy','Thuong','Tien','Trang','Tram','Trinh','Truc','Tuyet','Uyen','Van','Vi','Xuan','Yen','Y','Phuong','Hong','Dao','Cuc','Hue','Sen','Le','Tuyen','Ha','Thu')
$tenNam = @('An','Binh','Cuong','Dung','Dat','Hai','Hieu','Hoang','Hung','Hung','Khai','Khoa','Kien','Lam','Long','Minh','Nam','Nghia','Nhan','Phong','Phu','Quang','Quan','Son','Tai','Thang','Thien','Toan','Tri','Trung','Tuan','Tung','Viet','Vu','Duy','Duc','Hao','Khanh','Bao','Thanh')

$BCRYPT_HASH = '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG'

function Get-RandomItem($arr) { $arr[(Get-Random -Maximum $arr.Count)] }
function Get-RandomInt($min, $max) { Get-Random -Minimum $min -Maximum ($max + 1) }

function Get-RandomDate($startDate, $endDate) {
    $range = ($endDate - $startDate).TotalDays
    $startDate.AddDays((Get-Random -Maximum ([int]$range)))
}

function Format-SqlDate($d) { $d.ToString("yyyy-MM-dd") }
function Format-SqlDateTime($d) { $d.ToString("yyyy-MM-dd HH:mm:ss") }

function Get-FemaleName { "$(Get-RandomItem $hoSimple) $(Get-RandomItem $demNu) $(Get-RandomItem $tenNu)" }
function Get-MaleName { "$(Get-RandomItem $hoSimple) $(Get-RandomItem $demNam) $(Get-RandomItem $tenNam)" }

function Get-CustomerName {
    if ((Get-Random -Maximum 100) -lt 80) { Get-FemaleName } else { Get-MaleName }
}

function Get-DOB {
    Get-RandomDate ([datetime]"1970-01-01") ([datetime]"2010-06-12")
}

function Get-Phone($index) {
    $prefixes = @('090','091','093','094','096','097','098','032','033','034','035','036','037','038','039','070','076','077','078','079','081','082','083','084','085','086','088','089')
    $prefix = Get-RandomItem $prefixes
    "$prefix$($index.ToString('D7'))"
}

function Escape-Sql($str) {
    if ($null -eq $str) { return "NULL" }
    $str -replace "'","''"
}

Write-Host "Starting seed data generation..."

# ===================== HEADER =====================
$sw.WriteLine("-- ====================================================================")
$sw.WriteLine("-- SEED DATA KHONG LO CHO BEAUTYBOOK")
$sw.WriteLine("-- 500 Dich vu | 5 Quan ly | 10 Thu ngan | 20 Nhan vien | 20,000 Khach")
$sw.WriteLine("-- Du lieu lich hen tu 2024 den nay")
$sw.WriteLine("-- Tao tu dong boi generate_seed.ps1")
$sw.WriteLine("-- Ngay tao: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$sw.WriteLine("-- ====================================================================")
$sw.WriteLine("")
$sw.WriteLine("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;")
$sw.WriteLine("SET FOREIGN_KEY_CHECKS = 0;")
$sw.WriteLine("SET UNIQUE_CHECKS = 0;")
$sw.WriteLine("SET AUTOCOMMIT = 0;")
$sw.WriteLine("")

# ===================== TRUNCATE =====================
$sw.WriteLine("-- Xoa du lieu cu")
$sw.WriteLine("DELETE FROM payments;")
$sw.WriteLine("DELETE FROM appointment_services;")
$sw.WriteLine("DELETE FROM appointments;")
$sw.WriteLine("DELETE FROM staff_weekly_availability;")
$sw.WriteLine("DELETE FROM users;")
$sw.WriteLine("DELETE FROM services;")
$sw.WriteLine("DELETE FROM service_category;")
$sw.WriteLine("DELETE FROM staff_role;")
$sw.WriteLine("ALTER TABLE users AUTO_INCREMENT = 1;")
$sw.WriteLine("ALTER TABLE services AUTO_INCREMENT = 1;")
$sw.WriteLine("ALTER TABLE appointments AUTO_INCREMENT = 1;")
$sw.WriteLine("ALTER TABLE appointment_services AUTO_INCREMENT = 1;")
$sw.WriteLine("ALTER TABLE payments AUTO_INCREMENT = 1;")
$sw.WriteLine("")

# ===================== STAFF ROLES =====================
$sw.WriteLine("-- ========== STAFF ROLES ==========")
$sw.WriteLine("INSERT INTO staff_role (id, role_name, description) VALUES")
$sw.WriteLine("  (1, 'Nhan vien', 'Nhan vien thuc hien dich vu cho khach hang'),")
$sw.WriteLine("  (2, 'Thu ngan', 'Nhan vien xu ly thanh toan va ho tro quay'),")
$sw.WriteLine("  (3, 'Quan ly', 'Nhan vien quan ly van hanh salon');")
$sw.WriteLine("")

# ===================== SERVICE CATEGORIES =====================
$sw.WriteLine("-- ========== SERVICE CATEGORIES ==========")
$sw.WriteLine("INSERT INTO service_category (id, category_name) VALUES")
$sw.WriteLine("  (1, 'Toc'), (2, 'Goi/Massage'), (3, 'Nail/Mong'), (4, 'Mi/May'), (5, 'Da mat'), (6, 'Khac');")
$sw.WriteLine("")

# ===================== 500 SERVICES =====================
Write-Host "Creating 500 services..."

$serviceData = @(
    @{cat='Toc'; prefix='Cat toc'; descs=@('ngan gon','layer','mullet','bob','pixie','tia mai','kieu Han','kieu Nhat','undercut','taper fade','wolf cut','shag','butterfly','curtain bangs','textured'); priceMin=80000; priceMax=250000; durMin=30; durMax=60; img='https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80'},
    @{cat='Toc'; prefix='Nhuom toc'; descs=@('highlight','lowlight','balayage','ombre','sombre','phu bac','tone nau','tone do','tone xam khoi','tone tim','tone xanh','tone vang','full dau','baby light','airtouch'); priceMin=300000; priceMax=3000000; durMin=90; durMax=240; img='https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'},
    @{cat='Toc'; prefix='Uon toc'; descs=@('song loi','xoan tu nhien','cup duoi','phong chan','uon lanh','uon nong','uon digital','kieu xoan','gon song','uon bob','xoan lon to','xoan lon nho','setting','cosmo','retro'); priceMin=500000; priceMax=1500000; durMin=90; durMax=180; img='https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=800&q=80'},
    @{cat='Toc'; prefix='Duoi toc'; descs=@('to tam','keratin','collagen','protein','cysteine','nano','sieu mem muot','chua xu','phuc hoi duoi','duoi cup','duoi tham my','hoa chat cao cap','Japanese straightening'); priceMin=500000; priceMax=1200000; durMin=90; durMax=150; img='https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80'},
    @{cat='Toc'; prefix='Hap dau'; descs=@('phuc hoi','duong am','collagen','keratin','argan','biotin','toc kho xo','toc hu ton','toc nhuom','sieu muot','tham my','cao cap','protein therapy'); priceMin=200000; priceMax=600000; durMin=45; durMax=90; img='https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80'},
    @{cat='Toc'; prefix='Tao kieu toc'; descs=@('du tiec','co dau','su kien','prom','bim toc','bui toc','xoan lon','thang suon','retro','vintage','modern','boho','elegant','glamour'); priceMin=200000; priceMax=800000; durMin=45; durMax=120; img='https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=800&q=80'},
    @{cat='Goi/Massage'; prefix='Goi dau'; descs=@('duong sinh','thu gian','thao duoc','tinh dau bac ha','tinh dau oai huong','detox','tri gau','ngua rung','kich moc','dau dua','vitamin','nha dam','collagen','keratin'); priceMin=60000; priceMax=200000; durMin=20; durMax=45; img='https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80'},
    @{cat='Goi/Massage'; prefix='Massage dau'; descs=@('an huyet','da thong kinh lac','giai toa stress','tri dau dau','thu gian sau','tang tuan hoan','lieu phap Nhat','Cranial sacral','phong cach Thai','truyen thong','Ayurvedic','hot stone','aromatherapy'); priceMin=100000; priceMax=300000; durMin=30; durMax=60; img='https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80'},
    @{cat='Goi/Massage'; prefix='Massage body'; descs=@('toan than','da nong','tinh dau','Thai','shiatsu','Thuy Dien','deep tissue','bamboo','lomi lomi','aromatherapy','hot stone','reflexology','prenatal','sport'); priceMin=200000; priceMax=600000; durMin=60; durMax=120; img='https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=800&q=80'},
    @{cat='Goi/Massage'; prefix='Massage mat'; descs=@('nang co','tre hoa','kobido','bam huyet','gua sha','roller da','collagen','giam nep nhan','sang da','thai doc','chong lao hoa','chuyen sau'); priceMin=150000; priceMax=400000; durMin=30; durMax=60; img='https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80'},
    @{cat='Nail/Mong'; prefix='Son gel'; descs=@('don sac','ombre','mat meo','kim cuong','son thach','guong','nhu','holographic','cat eye','chrome','aurora','velvet','marble','galaxy','French'); priceMin=80000; priceMax=300000; durMin=30; durMax=60; img='https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80'},
    @{cat='Nail/Mong'; prefix='Nail art'; descs=@('ve tay','dap bot','dinh da','foil','sticker','stamping','watercolor','an xa cu','hoa 3D','thiet ke rieng','phong cach Nhat','minimalist','French tip','ombre art'); priceMin=150000; priceMax=500000; durMin=45; durMax=90; img='https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=800&q=80'},
    @{cat='Nail/Mong'; prefix='Cham soc mong'; descs=@('manicure','pedicure','combo tay chan','nhat da','sua dang','duong am','kem tay chan','paraffin','scrub','cha got','spa mong','cuticle care','nail strengthening'); priceMin=50000; priceMax=200000; durMin=20; durMax=45; img='https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80'},
    @{cat='Nail/Mong'; prefix='Noi mong'; descs=@('gel tips','acrylic','polygel','builder gel','fiber glass','silk wrap','coffin','stiletto','almond','ballerina','square','oval','nails extension','soft gel'); priceMin=200000; priceMax=600000; durMin=60; durMax=120; img='https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80'},
    @{cat='Mi/May'; prefix='Noi mi'; descs=@('classic','volume','mega volume','hybrid','wispy','wet look','katun','Kim cuong','YY','fox eye','doll eye','natural','silk','mink'); priceMin=150000; priceMax=500000; durMin=60; durMax=120; img='https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80'},
    @{cat='Mi/May'; prefix='Uon mi'; descs=@('collagen','keratin','lash lift','phu den','duong mi','uon nhiem','lamination','botox mi','uon song','permanent'); priceMin=100000; priceMax=300000; durMin=30; durMax=60; img='https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=800&q=80'},
    @{cat='Mi/May'; prefix='Phun may'; descs=@('ombre','hairstroke','combo','powder','mist','feather','nano','microblading','shading','silk','3D','6D','9D'); priceMin=1500000; priceMax=4000000; durMin=90; durMax=180; img='https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=800&q=80'},
    @{cat='Mi/May'; prefix='Waxing may'; descs=@('tia dang','dinh hinh','waxing sap','chi An Do','kep nhip','tao dang chuan','chinh hinh','tay long may'); priceMin=40000; priceMax=120000; durMin=15; durMax=30; img='https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=800&q=80'},
    @{cat='Da mat'; prefix='Cham soc da'; descs=@('co ban','chuyen sau','tri mun','tri nam','trang sang','chong lao hoa','cap am','da nhay cam','da dau','da kho','da hon hop','detox','thu nho lo chan long'); priceMin=150000; priceMax=600000; durMin=45; durMax=90; img='https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80'},
    @{cat='Da mat'; prefix='Peel da'; descs=@('AHA','BHA','salicylic','glycolic','lactic','TCA','jessner','enzyme','retinol','vitamin C','fruit acid','chemical peel'); priceMin=200000; priceMax=500000; durMin=30; durMax=60; img='https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80'},
    @{cat='Da mat'; prefix='Dap mat na'; descs=@('collagen','vang 24k','tao bien','than hoat tinh','hyaluronic','noc ong','yen sao','tra xanh','nghe','vitamin E','bio-cellulose','hydrogel'); priceMin=100000; priceMax=400000; durMin=30; durMax=60; img='https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80'},
    @{cat='Da mat'; prefix='Laser tri lieu'; descs=@('carbon','fractional','IPL','Q-switch','Nd-YAG','tri nam','tri seo','tre hoa','se khit','xoa xam','picosure','co2'); priceMin=500000; priceMax=2000000; durMin=30; durMax=90; img='https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?auto=format&fit=crop&w=800&q=80'},
    @{cat='Khac'; prefix='Waxing long'; descs=@('tay','chan','nach','bikini','toan than','mep','lung','bung','nguc','mat','ria mep','underarm'); priceMin=50000; priceMax=300000; durMin=15; durMax=60; img='https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80'},
    @{cat='Khac'; prefix='Triet long'; descs=@('diode laser','IPL','SHR','OPT','vinh vien','nach','chan','tay','bikini','mat','toan than','underarm'); priceMin=200000; priceMax=800000; durMin=15; durMax=60; img='https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?auto=format&fit=crop&w=800&q=80'},
    @{cat='Khac'; prefix='Tam trang'; descs=@('phi thuyen','collagen','nano','vitamin C','u trang','tam sua','tam ruou vang','tam thao duoc','tam tinh dau','whitening','body spa'); priceMin=300000; priceMax=1000000; durMin=60; durMax=120; img='https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=800&q=80'}
)

$services = @()
$serviceId = 1
$suffixes = @('cao cap','VIP','premium','dac biet','chuyen sau','nang cao','exclusive','deluxe','signature','pro')

foreach ($tmpl in $serviceData) {
    foreach ($desc in $tmpl.descs) {
        if ($serviceId -gt 500) { break }
        $name = "$($tmpl.prefix) $desc"
        $price = [Math]::Round((Get-RandomInt $tmpl.priceMin $tmpl.priceMax) / 10000) * 10000
        $duration = [Math]::Round((Get-RandomInt $tmpl.durMin $tmpl.durMax) / 5) * 5
        $services += @{id=$serviceId; name=$name; price=$price; duration=$duration; cat=$tmpl.cat; img=$tmpl.img}
        $serviceId++
    }
}

# Fill remaining with variations
$vi = 0
while ($services.Count -lt 500) {
    $tmpl = Get-RandomItem $serviceData
    $desc = Get-RandomItem $tmpl.descs
    $suffix = $suffixes[$vi % $suffixes.Count]
    $name = "$($tmpl.prefix) $desc $suffix"
    $price = [Math]::Round((Get-RandomInt $tmpl.priceMin $tmpl.priceMax) / 10000) * 10000
    $duration = [Math]::Round((Get-RandomInt $tmpl.durMin $tmpl.durMax) / 5) * 5
    $services += @{id=$services.Count+1; name=$name; price=$price; duration=$duration; cat=$tmpl.cat; img=$tmpl.img}
    $vi++
}

# Write services in batches
$sw.WriteLine("-- ========== 500 DICH VU ==========")
$batchSize = 100
for ($i = 0; $i -lt $services.Count; $i += $batchSize) {
    $end = [Math]::Min($i + $batchSize, $services.Count)
    $sw.WriteLine("INSERT INTO services (id, name, price, duration, description, category, image_url, status) VALUES")
    for ($j = $i; $j -lt $end; $j++) {
        $s = $services[$j]
        $desc = "Dich vu $(($s.name).ToLower()) chuyen nghiep tai BeautyBook Salon."
        $comma = if ($j -lt $end - 1) { "," } else { ";" }
        $sw.WriteLine("  ($($s.id), '$(Escape-Sql $s.name)', $($s.price), $($s.duration), '$(Escape-Sql $desc)', '$(Escape-Sql $s.cat)', '$($s.img)', 'active')$comma")
    }
    $sw.WriteLine("")
}

Write-Host "  500 services created"

# ===================== USERS =====================
Write-Host "Creating users..."

# Quan ly (5) - IDs 1-5
$managerNames = @('Nguyen Van Minh','Tran Thi Huong','Le Hoang Dung','Pham Ngoc Lan','Hoang Duc Thang')
$sw.WriteLine("-- ========== QUAN LY (5) ==========")
$sw.WriteLine("INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, date_of_birth, created_at) VALUES")
for ($i = 0; $i -lt 5; $i++) {
    $dob = Format-SqlDate (Get-RandomDate ([datetime]"1975-01-01") ([datetime]"1990-12-31"))
    $comma = if ($i -lt 4) { "," } else { ";" }
    $sw.WriteLine("  ($($i+1), '$($managerNames[$i])', 'quanly$($i+1)@beautybook.com', '$BCRYPT_HASH', '090100000$($i+1)', 'admin', 3, 1, '$dob', '2024-01-01 08:00:00')$comma")
}
$sw.WriteLine("")

# Thu ngan (10) - IDs 6-15
$cashierNames = @('Vu Thi Tam','Dang Hong Nhung','Bui Thanh Ha','Do Phuong Mai','Ngo Thuy Linh','Ly Kim Chi','Trinh Ngoc Anh','Cao Minh Thu','To Quynh Hoa','Dinh Bich Ngoc')
$sw.WriteLine("-- ========== THU NGAN (10) ==========")
$sw.WriteLine("INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, date_of_birth, created_at) VALUES")
for ($i = 0; $i -lt 10; $i++) {
    $dob = Format-SqlDate (Get-RandomDate ([datetime]"1985-01-01") ([datetime]"2000-12-31"))
    $comma = if ($i -lt 9) { "," } else { ";" }
    $sw.WriteLine("  ($($i+6), '$($cashierNames[$i])', 'thungan$($i+1)@beautybook.com', '$BCRYPT_HASH', '0901200$($($i+1).ToString('D03'))', 'staff', 2, 1, '$dob', '2024-01-01 08:00:00')$comma")
}
$sw.WriteLine("")

# Nhan vien dich vu (20) - IDs 16-35
$staffNames = @('Nguyen Ngoc Trinh','Tran Thuy Linh','Le Bao Ngoc','Pham Phuong Anh','Hoang Khanh Vy','Vu Thanh Truc','Dang My Duyen','Bui Hai Yen','Do Thu Hang','Ngo Dieu Linh','Ly Hoang Mai','Trinh Bich Phuong','Cao Anh Tuyet','To Minh Chau','Dinh Xuan Lan','Mai Thanh Huyen','Duong Ngoc Ha','Phan Thi Trang','Ho Quynh Nhu','Luong Thuy An')
$sw.WriteLine("-- ========== NHAN VIEN DICH VU (20) ==========")
$sw.WriteLine("INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, date_of_birth, created_at) VALUES")
for ($i = 0; $i -lt 20; $i++) {
    $dob = Format-SqlDate (Get-RandomDate ([datetime]"1990-01-01") ([datetime]"2002-12-31"))
    $comma = if ($i -lt 19) { "," } else { ";" }
    $sw.WriteLine("  ($($i+16), '$($staffNames[$i])', 'nhanvien$($i+1)@beautybook.com', '$BCRYPT_HASH', '0901300$($($i+1).ToString('D03'))', 'staff', 1, 1, '$dob', '2024-01-01 08:00:00')$comma")
}
$sw.WriteLine("")

# Staff weekly availability
$sw.WriteLine("-- ========== LICH LAM VIEC NHAN VIEN ==========")
$sw.WriteLine("INSERT INTO staff_weekly_availability (staff_id, day_of_week, start_time, end_time) VALUES")
$availRows = @()
for ($i = 0; $i -lt 20; $i++) {
    $staffId = $i + 16
    $shift = $i % 3
    for ($day = 0; $day -lt 7; $day++) {
        if ($shift -eq 0) {
            $start = if ($day -lt 5) { '08:00:00' } else { '07:00:00' }
            $end = if ($day -lt 5) { '16:00:00' } else { '15:00:00' }
        } elseif ($shift -eq 1) {
            $start = if ($day -lt 5) { '12:00:00' } else { '09:00:00' }
            $end = if ($day -lt 5) { '21:00:00' } else { '17:00:00' }
        } else {
            if ($day % 2 -eq 0) { $start = '08:00:00'; $end = '16:00:00' }
            else { $start = '12:00:00'; $end = '20:00:00' }
        }
        $availRows += "  ($staffId, $day, '$start', '$end')"
    }
}
$sw.WriteLine(($availRows -join ",`n") + ";")
$sw.WriteLine("")

# ===================== 20,000 KHACH HANG =====================
Write-Host "Creating 20,000 customers..."
$CUSTOMER_START = 36
$NUM_CUSTOMERS = 20000
$segments = @('New Customers','Champions','Loyal Customers','Potential Loyalists','Need Attention','At Risk','About to Sleep','Hibernating')
$segWeights = @(40,5,10,15,10,8,7,5)

$emailSet = @{}
$customerBatch = 500

for ($batch = 0; $batch -lt $NUM_CUSTOMERS; $batch += $customerBatch) {
    $batchEnd = [Math]::Min($batch + $customerBatch, $NUM_CUSTOMERS)
    $sw.WriteLine("INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, date_of_birth, customer_segment, created_at) VALUES")
    
    for ($k = $batch; $k -lt $batchEnd; $k++) {
        $userId = $CUSTOMER_START + $k
        $name = Get-CustomerName
        $emailBase = ($name -replace '\s','').ToLower()
        $email = "$emailBase$userId@gmail.com"
        $ct = 0
        while ($emailSet.ContainsKey($email) -and $ct -lt 10) {
            $email = "$emailBase$userId$(Get-Random -Maximum 9999)@gmail.com"
            $ct++
        }
        $emailSet[$email] = $true
        
        $dob = Format-SqlDate (Get-DOB)
        $phone = Get-Phone $userId
        $createdAt = Format-SqlDateTime (Get-RandomDate ([datetime]"2024-01-01") ([datetime]"2026-06-12"))
        
        # Random segment
        $r = Get-Random -Maximum 100
        $cum = 0; $seg = 'New Customers'
        for ($s = 0; $s -lt $segments.Count; $s++) {
            $cum += $segWeights[$s]
            if ($r -lt $cum) { $seg = $segments[$s]; break }
        }
        
        $comma = if ($k -lt $batchEnd - 1) { "," } else { ";" }
        $sw.WriteLine("  ($userId, '$(Escape-Sql $name)', '$(Escape-Sql $email)', '$BCRYPT_HASH', '$phone', 'customer', NULL, 1, '$dob', '$seg', '$createdAt')$comma")
    }
    $sw.WriteLine("")
    
    if (($batch + $customerBatch) % 5000 -eq 0) {
        Write-Host "  $([Math]::Min($batch + $customerBatch, $NUM_CUSTOMERS)) / $NUM_CUSTOMERS customers created"
    }
}

# ===================== APPOINTMENTS =====================
Write-Host "Creating appointments for all customers..."

$staffIds = 16..35
$timeSlots = @('08:00:00','08:30:00','09:00:00','09:30:00','10:00:00','10:30:00','11:00:00','13:00:00','13:30:00','14:00:00','14:30:00','15:00:00','15:30:00','16:00:00','16:30:00','17:00:00','17:30:00','18:00:00','18:30:00','19:00:00','19:30:00','20:00:00')
$statusList = @('completed','completed','completed','completed','completed','completed','completed','confirmed','pending','cancelled')
$paymentMethods = @('cash','banking','momo','vnpay','vietqr')
$START_DATE = [datetime]"2024-01-01"
$END_DATE = [datetime]"2026-06-12"

$appointmentId = 1
$apptBatch = @()
$apptSvcBatch = @()
$payBatch = @()
$apptBatchSize = 2000

$sw.WriteLine("-- ========== LICH HEN (appointments) ==========")

for ($i = 0; $i -lt $NUM_CUSTOMERS; $i++) {
    $userId = $CUSTOMER_START + $i
    $numAppts = Get-RandomInt 2 5
    
    for ($j = 0; $j -lt $numAppts; $j++) {
        $svcIdx = Get-Random -Maximum $services.Count
        $svc = $services[$svcIdx]
        $staffId = Get-RandomItem $staffIds
        $apptDate = Get-RandomDate $START_DATE $END_DATE
        $timeSlot = Get-RandomItem $timeSlots
        $status = Get-RandomItem $statusList
        
        # End time
        $parts = $timeSlot.Split(':')
        $endMins = [int]$parts[0] * 60 + [int]$parts[1] + $svc.duration
        $endH = [Math]::Min([Math]::Floor($endMins / 60), 23)
        $endM = $endMins % 60
        $endTime = "$($endH.ToString('D2')):$($endM.ToString('D2')):00"
        
        $totalAmount = $svc.price
        $rating = if ($status -eq 'completed') { Get-RandomInt 3 5 } else { 'NULL' }
        $createdAt = Format-SqlDateTime ($apptDate.AddDays(-(Get-RandomInt 0 7)))
        
        $apptBatch += "($appointmentId, $userId, $($svc.id), $staffId, '$(Format-SqlDate $apptDate)', '$timeSlot', '$endTime', '$status', $totalAmount, $totalAmount, $rating, '$createdAt')"
        $apptSvcBatch += "($appointmentId, $($svc.id), 0, $($svc.price), $($svc.duration), '$(Escape-Sql $svc.name)')"
        
        if ($status -eq 'completed' -or $status -eq 'confirmed') {
            $method = Get-RandomItem $paymentMethods
            $payStatus = if ($status -eq 'completed') { 'paid' } else { 'pending' }
            $payBatch += "($appointmentId, $totalAmount, '$method', '$payStatus', '$createdAt')"
        }
        
        $appointmentId++
        
        # Flush appointment batch
        if ($apptBatch.Count -ge $apptBatchSize) {
            $sw.WriteLine("INSERT INTO appointments (id, user_id, service_id, staff_id, appointment_date, appointment_time, end_time, status, total_amount, original_amount, staff_rating, created_at) VALUES")
            $sw.WriteLine("  " + ($apptBatch -join ",`n  ") + ";")
            $sw.WriteLine("")
            $apptBatch = @()
        }
    }
    
    if (($i + 1) % 5000 -eq 0) {
        Write-Host "  $($i + 1) / $NUM_CUSTOMERS customers processed for appointments"
    }
}

# Flush remaining appointments
if ($apptBatch.Count -gt 0) {
    $sw.WriteLine("INSERT INTO appointments (id, user_id, service_id, staff_id, appointment_date, appointment_time, end_time, status, total_amount, original_amount, staff_rating, created_at) VALUES")
    $sw.WriteLine("  " + ($apptBatch -join ",`n  ") + ";")
    $sw.WriteLine("")
}

Write-Host "  Total appointments: $($appointmentId - 1)"

# Write appointment_services
Write-Host "Writing appointment services..."
$sw.WriteLine("-- ========== CHI TIET DICH VU ==========")
for ($i = 0; $i -lt $apptSvcBatch.Count; $i += $apptBatchSize) {
    $end = [Math]::Min($i + $apptBatchSize, $apptSvcBatch.Count)
    $batch = $apptSvcBatch[$i..($end-1)]
    $sw.WriteLine("INSERT INTO appointment_services (appointment_id, service_id, sort_order, price_snapshot, duration_snapshot, service_name_snapshot) VALUES")
    $sw.WriteLine("  " + ($batch -join ",`n  ") + ";")
    $sw.WriteLine("")
}

# Write payments
Write-Host "Writing payments..."
$sw.WriteLine("-- ========== THANH TOAN ==========")
for ($i = 0; $i -lt $payBatch.Count; $i += $apptBatchSize) {
    $end = [Math]::Min($i + $apptBatchSize, $payBatch.Count)
    $batch = $payBatch[$i..($end-1)]
    $sw.WriteLine("INSERT INTO payments (appointment_id, amount, payment_method, payment_status, created_at) VALUES")
    $sw.WriteLine("  " + ($batch -join ",`n  ") + ";")
    $sw.WriteLine("")
}

# ===================== COMMIT =====================
$sw.WriteLine("COMMIT;")
$sw.WriteLine("SET FOREIGN_KEY_CHECKS = 1;")
$sw.WriteLine("SET UNIQUE_CHECKS = 1;")
$sw.WriteLine("SET AUTOCOMMIT = 1;")
$sw.WriteLine("")
$sw.WriteLine("ALTER TABLE users AUTO_INCREMENT = $($CUSTOMER_START + $NUM_CUSTOMERS + 1);")
$sw.WriteLine("ALTER TABLE services AUTO_INCREMENT = 501;")
$sw.WriteLine("ALTER TABLE appointments AUTO_INCREMENT = $appointmentId;")
$sw.WriteLine("")
$sw.WriteLine("-- ====================================================================")
$sw.WriteLine("-- HOAN TAT!")
$sw.WriteLine("--   500 dich vu")
$sw.WriteLine("--   5 quan ly")
$sw.WriteLine("--   10 thu ngan")
$sw.WriteLine("--   20 nhan vien dich vu")
$sw.WriteLine("--   20,000 khach hang")
$sw.WriteLine("--   $($appointmentId - 1) lich hen")
$sw.WriteLine("--   $($apptSvcBatch.Count) chi tiet dich vu")
$sw.WriteLine("--   $($payBatch.Count) thanh toan")
$sw.WriteLine("-- ====================================================================")

$sw.Flush()
$sw.Close()

$fileSize = [Math]::Round((Get-Item $outputFile).Length / 1MB, 2)
Write-Host ""
Write-Host "HOAN TAT!"
Write-Host "File: $outputFile"
Write-Host "Kich thuoc: $fileSize MB"
Write-Host ""
Write-Host "Thong ke:"
Write-Host "  - 500 dich vu"
Write-Host "  - 5 quan ly (admin)"
Write-Host "  - 10 thu ngan (staff/cashier)"
Write-Host "  - 20 nhan vien dich vu (staff/service)"
Write-Host "  - 20,000 khach hang"
Write-Host "  - $($appointmentId - 1) lich hen"
Write-Host "  - $($payBatch.Count) thanh toan"
Write-Host ""
Write-Host "Cach su dung:"
Write-Host "  1. Mo phpMyAdmin hoac MySQL CLI"
Write-Host "  2. Chon database booking_system"
Write-Host "  3. Import file seed_massive.sql"
