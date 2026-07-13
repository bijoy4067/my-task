import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./../../services/AuthServiceProvider";

function validate({ email, password }) {
  const errors = {};

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
}

export default function App() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const errors = validate({ email, password });
  // Field errors stay hidden until the field is blurred or a submit is attempted.
  const showError = (field) => (touched[field] || submitted) && errors[field];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await login({ email, password, remember });
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <section className="_social_login_wrapper _layout_main_wrapper">
        <div className="_shape_one">
          <img
            src="/assets/images/shape1.svg"
            alt=""
            className="_shape_img"
          />
          <img
            src="/assets/images/dark_shape.svg"
            alt=""
            className="_dark_shape"
          />
        </div>

        <div className="_shape_two">
          <img
            src="/assets/images/shape2.svg"
            alt=""
            className="_shape_img"
          />
          <img
            src="/assets/images/dark_shape1.svg"
            alt=""
            className="_dark_shape _dark_shape_opacity"
          />
        </div>

        <div className="_shape_three">
          <img
            src="/assets/images/shape3.svg"
            alt=""
            className="_shape_img"
          />
          <img
            src="/assets/images/dark_shape2.svg"
            alt=""
            className="_dark_shape _dark_shape_opacity"
          />
        </div>

        <div className="_social_login_wrap">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-xl-8 col-lg-8 col-md-12 col-sm-12">
                <div className="_social_login_left">
                  <div className="_social_login_left_image">
                    <img
                      src="/assets/images/login.png"
                      alt="Image"
                      className="_left_img"
                    />
                  </div>
                </div>
              </div>

              <div className="col-xl-4 col-lg-4 col-md-12 col-sm-12">
                <div className="_social_login_content">
                  <div className="_social_login_left_logo _mar_b28">
                    <img
                      src="/assets/images/logo.svg"
                      alt="Logo"
                      className="_left_logo"
                    />
                  </div>

                  <p className="_social_login_content_para _mar_b8">
                    Welcome back
                  </p>

                  <h4 className="_social_login_content_title _titl4 _mar_b50">
                    Login to your account
                  </h4>

                  <button
                    type="button"
                    className="_social_login_content_btn _mar_b40"
                  >
                    <img
                      src="/assets/images/google.svg"
                      alt="Google"
                      className="_google_img"
                    />{" "}
                    <span>Or sign-in with Google</span>
                  </button>

                  <div className="_social_login_content_bottom_txt _mar_b40">
                    <span>Or</span>
                  </div>

                  <form className="_social_login_form" onSubmit={handleSubmit} noValidate>
                    <div className="row">
                      <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_login_form_input _mar_b14">
                          <label
                            className="_social_login_label _mar_b8"
                            htmlFor="login_email"
                          >
                            Email
                          </label>
                          <input
                            id="login_email"
                            type="email"
                            className="form-control _social_login_input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() =>
                              setTouched((prev) => ({ ...prev, email: true }))
                            }
                          />
                          {showError("email") && (
                            <p className="text-danger">{errors.email}</p>
                          )}
                        </div>
                      </div>

                      <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_login_form_input _mar_b14">
                          <label
                            className="_social_login_label _mar_b8"
                            htmlFor="login_password"
                          >
                            Password
                          </label>
                          <input
                            id="login_password"
                            type="password"
                            className="form-control _social_login_input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={() =>
                              setTouched((prev) => ({ ...prev, password: true }))
                            }
                          />
                          {showError("password") && (
                            <p className="text-danger">{errors.password}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-lg-6 col-xl-6 col-md-6 col-sm-12">
                        <div className="form-check _social_login_form_check">
                          <input
                            className="form-check-input _social_login_form_check_input"
                            type="checkbox"
                            id="flexRadioDefault2"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                          />

                          <label
                            className="form-check-label _social_login_form_check_label"
                            htmlFor="flexRadioDefault2"
                          >
                            Remember me
                          </label>
                        </div>
                      </div>

                      <div className="col-lg-6 col-xl-6 col-md-6 col-sm-12">
                        <div className="_social_login_form_left">
                          <p className="_social_login_form_left_para">
                            Forgot password?
                          </p>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="row">
                        <div className="col-lg-12 col-md-12 col-xl-12 col-sm-12">
                          <p className="text-danger">{error}</p>
                        </div>
                      </div>
                    )}

                    <div className="row">
                      <div className="col-lg-12 col-md-12 col-xl-12 col-sm-12">
                        <div className="_social_login_form_btn _mar_t40 _mar_b60">
                          <button
                            type="submit"
                            className="_social_login_form_btn_link _btn1"
                            disabled={submitting}
                          >
                            {submitting ? "Logging in…" : "Login now"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>

                  <div className="row">
                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                      <div className="_social_login_bottom_txt">
                        <p className="_social_login_bottom_txt_para">
                          Don't have an account?{" "}
                          <Link to="/register">Create New Account</Link>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}