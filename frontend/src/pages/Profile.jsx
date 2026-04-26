import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './Profile.css';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function getProfile() {
      setLoading(true);
      // Hardcoded ID for development testing
      const targetId = "edda4b7f-757a-491f-a65e-ddf2dc3842bd"; 

      const { data, error } = await supabase
        .from('profiles')
        .select(`name, bio, profile_image, skills, has_shop, shops (title)`)
        .eq('id', targetId)
        .single();

      if (error) console.error("Error fetching data:", error);
      else setProfile(data);
      
      setLoading(false);
    }
    getProfile();
  }, []);

  if (loading) return <div className="page-wrapper loading">Loading...</div>;
  if (!profile) return <div className="page-wrapper error">Profile data not found.</div>;

  return (
    <div className="page-wrapper">
      <div className="profile-container">
        
        {/* Top Section: Profile Picture */}
        <div className="profile-image-box">
          <img src={profile.profile_image || 'https://via.placeholder.com/150'} alt="Profile" />
        </div>

        {/* Middle Section: Info Grid (Inputs Style) */}
        <div className="info-grid">
          
          <span className="label">Name:</span>
          <div className="input-value-box">{profile.name}</div>
          
          <span className="label">Bio:</span>
          <div className="input-value-box bio-text">{profile.bio || "No bio added."}</div>
          
          <span className="label">Skills:</span>
          <div className="input-value-box skills-box">
            {profile.skills?.map((s, i) => <span key={i} className="skill-tag">{s}</span>)}
          </div>

          <span className="label">Shop:</span>
          <div className="input-value-box shop-box">
             {profile.has_shop && profile.shops ? profile.shops.title : "None"}
          </div>
        </div>
      </div>

      {/* Bottom Section: Buttons (outside main card) */}
      <div className="action-button-group">
        <button className="icon-button" onClick={() => navigate('/create-shop')}>
  {profile.has_shop ? "Edit Shop" : "Create shop"} 
  <span className="button-icon">🛍️</span>
</button>

<button className="icon-button" onClick={() => navigate('/create-request')}>
  Create Request 
  <span className="button-icon">💌</span>
</button>
      </div>
    </div>
  );
}