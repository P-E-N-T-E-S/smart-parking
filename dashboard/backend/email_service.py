import smtplib
from email.mime.text import MIMEText

SMTP_HOST = "localhost"   # MailHog
SMTP_PORT = 1025          # Porta SMTP do MailHog
FROM_EMAIL = "gitpentes@gmailc.om"

def send_email(to_email, subject, body):
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.sendmail(FROM_EMAIL, [to_email], msg.as_string())
            print(f" Email enviado para {to_email} (MailHog)")
    except Exception as e:
        print(f" Erro ao enviar email: {e}")