// 클라이언트에 그대로 보여줘도 되는 오류 (status + message)
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

module.exports = { HttpError };
