// 클라이언트에 그대로 보여줘도 되는 오류 (status + message, data 는 응답에 함께 실을 추가 정보)
class HttpError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.status = status;
    this.expose = true;
    this.data = data;
  }
}

module.exports = { HttpError };
