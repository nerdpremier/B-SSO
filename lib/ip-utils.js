const SAFE_IP_REGEX = /^[\d.:a-fA-F\[\]%]+$/;

const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.|::ffff:172\.(1[6-9]|2\d|3[01])\.|[fF][cCdD][0-9a-fA-F]{2}:|[fF][eE][89aAbB][0-9a-fA-F]:)/;

export function getClientIp(req) {

    const socketIp = req.socket?.remoteAddress || '';

    if (PRIVATE_IP_REGEX.test(socketIp)) {

        const xff = req.headers['x-forwarded-for'];
        if (xff && typeof xff === 'string') {
            const parts = xff.split(',');
            const raw   = parts[parts.length - 1]?.trim() || '';

            if (raw.length > 0 && raw.length <= 45 && SAFE_IP_REGEX.test(raw)) {
                return raw;
            }
        }

        if (socketIp.length > 0 && socketIp.length <= 45 && SAFE_IP_REGEX.test(socketIp)) {
            return socketIp;
        }
        return '0.0.0.0';
    }

    if (socketIp.length === 0 || socketIp.length > 45) {
        return '0.0.0.0';
    }
    if (!SAFE_IP_REGEX.test(socketIp)) {
        return '0.0.0.0';
    }
    return socketIp;
}
