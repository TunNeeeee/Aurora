# Miu Miu — nhật ký chăm mèo

Website có thể cài lên iPhone dưới dạng PWA. Dữ liệu hồ sơ, lịch tiêm, bữa ăn và thu chi được lưu trong Google Sheets của bạn sau khi kết nối; trước khi kết nối hoặc khi ngoại tuyến, ứng dụng giữ thay đổi trên thiết bị.

## Kết nối Google Sheets

1. Ứng dụng đã được cấu hình sẵn Google Sheet và OAuth Client ID mặc định; mở Sheet bằng đúng tài khoản Google sẽ dùng trong ứng dụng.
2. Trong [Google Cloud Console](https://console.cloud.google.com/), bật **Google Sheets API** cho project OAuth đã cấu hình và thiết lập màn hình OAuth consent. Nếu ứng dụng ở chế độ kiểm thử, thêm tài khoản Google của bạn vào danh sách test users.
3. Trong OAuth Client ID loại **Web application**, thêm chính xác origin nơi bạn lưu ứng dụng vào **Authorized JavaScript origins** (ví dụ `https://ten-cua-ban.github.io`). Không cần redirect URI.
4. Đưa toàn bộ thư mục ứng dụng lên một dịch vụ lưu trữ HTTPS. Ví dụ với GitHub Pages: tạo repository, tải các file/thư mục của ứng dụng lên, vào **Settings → Pages**, chọn nhánh và thư mục xuất bản. Dùng URL HTTPS Pages làm Authorized JavaScript origin ở bước 3. Không mở ứng dụng bằng `file://` để đăng nhập Google.
5. Mở ứng dụng đã xuất bản, chọn **Google Sheets**, đăng nhập và chấp thuận quyền truy cập. Ứng dụng sẽ tự tạo các tab `Cats`, `Vaccines`, `Transactions`, `Meals`; Sheet trống sẽ được khởi tạo bằng dữ liệu hiện có trên thiết bị.

Ứng dụng dùng OAuth trong trình duyệt và gọi Google Sheets API trực tiếp. Không cần Apps Script, API key hay máy chủ lưu trữ dữ liệu trung gian. Client ID là thông tin công khai; **không đặt mật khẩu hoặc client secret của Google trong ứng dụng**.

Sau khi đăng nhập, thay đổi được tự động đồng bộ lên Sheet; không cần nút đồng bộ riêng. Nếu tạm mất mạng, ứng dụng sẽ thử đồng bộ lại khi mạng trở lại. Google chỉ cấp access token tạm thời trong phiên trình duyệt, vì vậy nếu mở lại ứng dụng mà trạng thái báo cần đăng nhập thì chạm **Google Sheets** và đăng nhập lại. Khi ngoại tuyến, thay đổi vẫn lưu ở thiết bị. Nếu có dữ liệu chưa đồng bộ và Sheet đã có dữ liệu, ứng dụng hỏi sen chọn dữ liệu trên thiết bị hay trên Sheet trước khi tiếp tục.

Trong trang **Tài chính**, có thể quét QR bằng camera hoặc chọn ảnh QR. Ứng dụng thử đọc số tiền và tên người nhận từ QR, nhưng cần kiểm tra lại trước khi thanh toán. Ảnh/mã QR được giải mã ngay trên thiết bị; bộ đọc QR được tải từ jsDelivr. Nút **Mở MoMo** chỉ mở ứng dụng MoMo; website không gửi sẵn QR/nội dung thanh toán và không thể xác minh MoMo đã thanh toán thành công. Chỉ bấm **Đã thanh toán · lưu** sau khi tự kiểm tra giao dịch trong MoMo. Giao dịch được tự động đồng bộ lên Sheet sau khi lưu.

ID Sheet và OAuth Client ID không hiển thị trong giao diện cài đặt. Đây chỉ là ẩn khỏi màn hình: vì ứng dụng chạy trong trình duyệt, người truy cập website vẫn có thể xem cấu hình trong mã nguồn/các yêu cầu mạng. Muốn bảo vệ ID Sheet khỏi người xem ứng dụng cần chuyển phần truy cập Sheet sang backend riêng.

## Cài lên iPhone

1. Mở URL HTTPS của ứng dụng bằng **Safari** trên iPhone.
2. Chạm **Chia sẻ** → **Thêm vào Màn hình chính** → **Thêm**.
3. Mở biểu tượng **Miu Miu** từ Màn hình chính. Đăng nhập Google Sheets trong ứng dụng để đồng bộ dữ liệu.

PWA có giao diện toàn màn hình và lưu giao diện để mở khi ngoại tuyến. Đây không phải ứng dụng native được ký/phân phối qua App Store; cài PWA không cần Mac hay tài khoản Apple Developer.

## Quyền truy cập và lưu ý

- Khi cấp quyền, Google cho ứng dụng quyền đọc/ghi Google Sheets trong tài khoản đã chọn. Chỉ kết nối Sheet mà bạn tin cậy.
- Ở chế độ kiểm thử OAuth, chỉ các tài khoản được thêm vào danh sách test users mới đăng nhập được; quyền OAuth đang ở chế độ kiểm thử có thể cần cấp lại định kỳ.
- Các thay đổi trên nhiều thiết bị không được gộp tự động theo từng ô; khi kết nối lại, Sheet hoặc dữ liệu đang chờ trên thiết bị sẽ được dùng làm nguồn dữ liệu theo lựa chọn của bạn.
- Lượng thức ăn và năng lượng hiển thị chỉ để tham khảo, không thay thế tư vấn của bác sĩ thú y.
